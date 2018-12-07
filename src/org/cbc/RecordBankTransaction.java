/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Date;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.utils.data.DatabaseSession;

/**
 *
 * @author chris
 */
public class RecordBankTransaction extends ApplicationServer {    
    private boolean transactionFor(Context ctx, Date timestamp) throws SQLException {
        ResultSet rs = executeQuery(
                ctx, "SELECT Timestamp FROM AccountTransaction WHERE Timestamp = '" + ctx.getDbTimestamp(timestamp) + 
                        "' AND Currency = '" + ctx.getParameter("currency") + "'");
        return rs.next();
    }
    private void createTransaction(Context ctx, Date timestamp, Date completed, String prefix) throws SQLException {
        String account  = ctx.getParameter(prefix + "account");
        String amount   = ctx.getParameter(prefix + "amount");
        String fee      = ctx.getParameter(prefix + "fee");
        String currency = ctx.getParameter(prefix + "currency");
        
        if (account == null || account.length() == 0) return;
        
        SQLInsertBuilder sql = ctx.getInsertBuilder("AccountTransaction");
        sql.addField("Timestamp",   ctx.getDbTimestamp(timestamp));
        sql.addField("Completed",   ctx.getDbTimestamp(completed));
        sql.addField("Account",     account);
        sql.addField("Amount",      amount);
        sql.addField("Fee",         fee.length() == 0? null : fee);
        sql.addField("Currency",    currency);
        sql.addField("Type",        ctx.getParameter("txntype"));
        sql.addField("Usage",       ctx.getParameter("txnusage"));
        sql.addField("Description", ctx.getParameter("description"));
        executeUpdate(ctx, sql);
        ctx.setStatus(200);
    }
    @Override
    public String getVersion() {
        return "V1.1 Released 05-Dec-18";    
    }
    public void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {
        databases.setApplication(
                super.config.getProperty("btdatabase"),
                super.config.getProperty("btuser"),
                super.config.getProperty("btpassword"));
    }  
    public void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        if (action.equals("transactions")) {
            JSONObject       data = new JSONObject();            
            SQLSelectBuilder  sql = ctx.getSelectBuilder("BankTransactions");

            sql.setProtocol(ctx.getAppDb().getProtocol());
            sql.setMaxRows(config.getIntProperty("banktransactionrows", 100));
            
            sql.addField("SeqNo");
            sql.addField("Timestamp");
            
            if (sql.getProtocol().equalsIgnoreCase("sqlserver")) {
                sql.addField("SUBSTRING(DATENAME(WEEKDAY, Timestamp), 1, 3)", "Weekday");
            } else {
                sql.addField("SubStr(DayName(Timestamp), 1, 3)", "Weekday");
            }
            sql.addField("Completed");
            sql.addDefaultedField("AccountNumber", "Number", "");
            sql.addDefaultedField("CardNumber",    "Card",   "");
            sql.addField("Account");
            sql.addField("Amount", null, null, "DECIMAL(10,2)");
            sql.addField("Fee",    null, null, "DECIMAL(10,2)");
            sql.addField("Currency");
            sql.addDefaultedField("Type",  "");
            sql.addDefaultedField("Usage", "" );
            sql.addField("Description");
            sql.setOrderBy("Timestamp DESC");
            ResultSet rs = executeQuery(ctx, sql);
            
            data.add("Transactions", rs, super.config.getProperty("bpoptionalcolumns"), false);
            data.append(ctx.getReplyBuffer(), "");

            ctx.setStatus(200);
        } else if (action.equals("accounts")) {
            JSONObject       data = new JSONObject();            
            SQLSelectBuilder  sql = ctx.getSelectBuilder(null);

            sql.setProtocol(ctx.getAppDb().getProtocol());
            sql.setMaxRows(config.getIntProperty("banktransactionrows", 100));
            
            sql.addField("A.Code", "Account");
            sql.addField("B.Bank");
            sql.addField("A.Owner");
            sql.addField("A.Description");
            
            sql.setFrom("Account A JOIN Bank B ON  A.Bank = B.Code");
            sql.setOrderBy("A.Code");
            ResultSet rs = executeQuery(ctx, sql);
            
            data.add("Accounts", rs, super.config.getProperty("bpoptionalcolumns"), false);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("getList")) {
            getList(ctx);
        } else if (action.equals("create")) {
            Date   timestamp = ctx.getTimestamp("date", "time");
            Date   completed = ctx.getTimestamp("cdate", "ctime");
            String seqNo     = ctx.getParameter("seqno");
            
            if (seqNo.length() != 0) {
                ResultSet rs;
                SQLSelectBuilder sql = ctx.getSelectBuilder("AccountTransaction");
                
                sql.addField("SeqNo");
                sql.addField("Timestamp");
                sql.addField("Completed");
                sql.addField("Account");
                sql.addField("Amount");
                sql.addField("Fee");
                sql.addField("Currency");
                sql.addField("Type");
                sql.addField("Usage");
                sql.addField("Description");
                sql.addAnd("SeqNo", "=", seqNo, false);
                rs = ctx.getAppDb().updateQuery(sql.build());
                    
                if (!rs.next())
                    ctx.getReplyBuffer().append("No record for SeqNo " + seqNo);
                else
                {
                    rs.moveToCurrentRow();
                    rs.updateTimestamp("Timestamp", ctx.getSQLTimestamp(timestamp));
                    rs.updateTimestamp("Completed", ctx.getSQLTimestamp(completed));
                    rs.updateString("Account",      ctx.getParameter("paccount"));
                    rs.updateString("Fee",          ctx.getParameter("pfee"));
                    rs.updateString("Amount",       ctx.getParameter("pamount"));
                    rs.updateString("Currency",     ctx.getParameter("pcurrency"));
                    rs.updateString("Type",         ctx.getParameter("txntype"));
                    rs.updateString("Usage",        ctx.getParameter("txnusage"));
                    rs.updateString("Description",  ctx.getParameter("description"));
                    rs.updateRow();
                    ctx.getAppDb().commit();
                    ctx.setStatus(200);
                }
            } else {
                if (transactionFor(ctx, timestamp)) {
                    ctx.getReplyBuffer().append("Change time as transaction already recorded at " + timestamp + " for currency " + ctx.getParameter("currency"));
                } else {
                    createTransaction(ctx, timestamp, completed, "p");
                    createTransaction(ctx, timestamp, completed, "s");                    
                }
            }
        } else if (action.equals("delete")) {
            SQLDeleteBuilder sql = ctx.getDeleteBuilder("AccountTransaction");
            
            sql.addAnd("SeqNo", "=", ctx.getParameter("seqno"), false);
            executeUpdate(ctx, sql.build());
            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid"); 
        }
    }
}
