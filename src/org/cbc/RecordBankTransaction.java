/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import foreignexchange.CurrencyRates;
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
import org.cbc.sql.SQLUpdateBuilder;

/**
 *
 * @author chris
 */
public class RecordBankTransaction extends ApplicationServer {    
    private CurrencyRates crates = new CurrencyRates();
    
    private String getBTC(String currency) {
        return currency.equalsIgnoreCase("mbtc")? "BTC" : currency;
    }
    private String getTXNId(Context ctx, int seqNo) {
        String sq = "" + seqNo;
        
        while (sq.length() < 5) sq = '0' + sq;
        
        return (ctx.getAppDb().getProtocol().equalsIgnoreCase("sqlserver")? "SQ" : "MY") + sq;
    }
    private boolean transactionFor(Context ctx, Date timestamp) throws SQLException {
        ResultSet rs = executeQuery(
                ctx, "SELECT Timestamp FROM AccountTransaction WHERE Timestamp = '" + ctx.getDbTimestamp(timestamp) + 
                        "' AND Currency = '" + ctx.getParameter("currency") + "'");
        return rs.next();
    }
    private String createTransaction(Context ctx, Date timestamp, Date completed, String prefix, String txnId) throws SQLException {
        String account  = ctx.getParameter(prefix + "account");
        String amount   = ctx.getParameter(prefix + "amount");
        String fee      = ctx.getParameter(prefix + "fee");
        String currency = ctx.getParameter(prefix + "currency");
        String address  = ctx.getParameter(prefix + "address");
        
        if (account == null || account.length() == 0) return null;
        
        SQLInsertBuilder sql = ctx.getInsertBuilder("AccountTransaction");
        sql.addField("Timestamp",     ctx.getDbTimestamp(timestamp));
        sql.addField("Completed",     ctx.getDbTimestamp(completed));
        sql.addField("Account",       account);
        sql.addField("Amount",        amount);
        sql.addField("Fee",           fee.length() == 0? null : fee);
        sql.addField("Currency",      currency);
        sql.addField("Type",          ctx.getParameter("txntype"));
        sql.addField("Usage",         ctx.getParameter("txnusage"));
        sql.addField("CryptoAddress", address);
        
        if (txnId == null) {
            int       seqNo = 0;
            
            sql.addField("Description", ctx.getParameter("description"));
            ResultSet rs    = executeUpdateGetKey(ctx, sql);
            
            if (rs.next()) seqNo = rs.getInt(1);
            
            txnId = getTXNId(ctx, seqNo);
            
            SQLUpdateBuilder sqlu = ctx.getUpdateBuilder("AccountTransaction");
            
            sqlu.addField("TXNId", txnId);
            sqlu.addAnd("SeqNo", "=", "" + seqNo, false);
            ctx.getAppDb().executeUpdate(sqlu.build());
        } else {        
            sql.addField("TXNId", txnId);

            executeUpdate(ctx, sql);
        }
        ctx.setStatus(200);
        
        return txnId;
        
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
        crates.setMaxAge(3600);
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
            sql.addDefaultedField("TXNId",    "'TXN Id'",   "");
            sql.addField("Amount", null, null, "DECIMAL(10,2)");
            sql.addField("Fee",    null, null, "DECIMAL(10,2)");
            sql.addField("Currency");
            sql.addDefaultedField("Type",  "");
            sql.addDefaultedField("Usage", "" );
            sql.addDefaultedField("CryptoAddress", "Address",   "");
            sql.addField("Description");
            sql.setOrderBy("Timestamp DESC");
            ResultSet rs = executeQuery(ctx, sql);
            
            data.add("Transactions", rs, super.config.getProperty("bpoptionalcolumns"), false);
            data.append(ctx.getReplyBuffer(), "");

            ctx.setStatus(200);
        } else if (action.equals("accounts")) {
            JSONObject       data = new JSONObject();            
            SQLSelectBuilder sql  = ctx.getSelectBuilder(null);

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
        } else if (action.equals("getRateData")) {
            JSONObject data   = new JSONObject();     
            String     fr     = ctx.getParameter("from");
            String     to     = ctx.getParameter("to");
            String     amount = ctx.getParameter("amount");
            double     rate   = 0;
            
            CurrencyRates.Rate rt = crates.getRate(getBTC(fr), getBTC(to));
            
            if (rt == null) {
                data.add("Source", "Unavailable");
            } else {
                rate = rt.getRate();

                if (fr.equalsIgnoreCase("mbtc")) rate /= 1000;
                if (to.equalsIgnoreCase("mbtc")) rate *= 1000;
                
                data.add("Source",    crates.getProvider().toString());
                data.add("Timestamp", ctx.getTimestamp(rt.getStats().getUpdated(), "dd-MMM-yyyy HH:mm:ss"));
                data.add("Rate",      rate);
                data.add("Amount",    Double.parseDouble(amount.length() == 0 ? "1" : amount) * rate);
            }
            data.append(ctx.getReplyBuffer());
            ctx.setStatus(200);            
        } else if (action.equals("create")) {
            Date   timestamp = ctx.getTimestamp("date",  "time");
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
                sql.addField("CryptoAddress");
                sql.addField("Description");
                sql.addAnd("SeqNo", "=", seqNo, false);
                rs = ctx.getAppDb().updateQuery(sql.build());
                    
                if (!rs.next())
                    ctx.getReplyBuffer().append("No record for SeqNo " + seqNo);
                else
                {
                    rs.moveToCurrentRow();
                    rs.updateTimestamp("Timestamp",  ctx.getSQLTimestamp(timestamp));
                    rs.updateTimestamp("Completed",  ctx.getSQLTimestamp(completed));
                    rs.updateString("Account",       ctx.getParameter("paccount"));
                    rs.updateString("Fee",           ctx.getParameter("pfee", null));
                    rs.updateString("Amount",        ctx.getParameter("pamount"));
                    rs.updateString("Currency",      ctx.getParameter("pcurrency"));
                    rs.updateString("Type",          ctx.getParameter("txntype"));
                    rs.updateString("Usage",         ctx.getParameter("txnusage"));
                    rs.updateString("CryptoAddress", ctx.getParameter("paddress"));
                    rs.updateString("Description",   ctx.getParameter("description"));
                    rs.updateRow();
                    ctx.getAppDb().commit();
                    ctx.setStatus(200);
                }
            } else {
                if (transactionFor(ctx, timestamp)) {
                    ctx.getReplyBuffer().append("Change time as transaction already recorded at " + timestamp + " for currency " + ctx.getParameter("currency"));
                } else {
                    String txnId;
                    
                    txnId = createTransaction(ctx, timestamp, completed, "p", null);
                    createTransaction(ctx, timestamp, completed, "s", txnId);                    
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
