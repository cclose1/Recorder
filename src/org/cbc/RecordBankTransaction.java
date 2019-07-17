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
    private String createTransaction(Context ctx, Date timestamp, String Description) throws SQLException {
        String txnId = null;
        int    seqNo = 0;
        
        SQLInsertBuilder sql = ctx.getInsertBuilder("TransactionHeader");
        
        sql.addField("Created",     ctx.getDbTimestamp(timestamp));
        sql.addField("Description", Description);
                 
        ResultSet rs = executeUpdateGetKey(ctx, sql);
            
        if (rs.next()) seqNo = rs.getInt(1);
        
        txnId = getTXNId(ctx, seqNo);
            
        SQLUpdateBuilder sqlu = ctx.getUpdateBuilder("TransactionHeader");
            
        sqlu.addField("TXNId", txnId);
        sqlu.addAnd("SeqNo", "=", "" + seqNo, false);
        ctx.getAppDb().executeUpdate(sqlu.build());
        
        return txnId;
    }
    private int getNextTXNLine(Context ctx, String txnId) throws SQLException {
        SQLSelectBuilder sql = ctx.getSelectBuilder("TransactionLine");
        
        sql.addDefaultedField("MAX(Line) + 1", "LineNum", 1);
        sql.addAnd("TXNId", "=", txnId);
        
        ResultSet rs = executeQuery(ctx, sql);
        
        rs.next();
        
        return rs.getInt("LineNum");
    }
    private void addTransactionLine(Context ctx, Date timestamp, Date completed, String prefix, String txnId) throws SQLException {
        String account     = ctx.getParameter(prefix + "account");
        String amount      = ctx.getParameter(prefix + "amount");
        String fee         = ctx.getParameter(prefix + "fee");
        String currency    = ctx.getParameter(prefix + "currency");
        String address     = ctx.getParameter(prefix + "address");
        String description = ctx.getParameter(prefix + "description");
        
        if (account == null || account.length() == 0) return;
        
        SQLInsertBuilder sql = ctx.getInsertBuilder("TransactionLine");
        sql.addField("TXNId",         txnId);
        sql.addField("Line",          getNextTXNLine(ctx, txnId));
        sql.addField("Timestamp",     ctx.getDbTimestamp(timestamp));
        sql.addField("Completed",     ctx.getDbTimestamp(completed));
        sql.addField("Account",       account);
        sql.addField("Amount",        amount);
        sql.addField("Fee",           fee.length() == 0? null : fee);
        sql.addField("Currency",      currency);
        sql.addField("Type",          ctx.getParameter("txntype"));
        sql.addField("Usage",         ctx.getParameter("txnusage"));
        sql.addField("CryptoAddress", address);
        sql.addField("Description",   description);
        executeUpdate(ctx, sql);
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
            String           filter = ctx.getParameter("filter");
            JSONObject       data   = new JSONObject();            
            SQLSelectBuilder sql    =  ctx.getSelectBuilder("BankTransactions");

            sql.setProtocol(ctx.getAppDb().getProtocol());
            sql.setMaxRows(config.getIntProperty("banktransactionrows", 100));
            
            sql.addField("TXNId");
            sql.addField("TXNDescription");
            sql.addField("Line");
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
            sql.addField("Amount", "AmountFull");
            sql.addField("Fee",    null, null, "DECIMAL(10,2)");
            sql.addField("Fee",    "FeeFull");
            sql.addField("Currency");
            sql.addDefaultedField("Type",  "");
            sql.addDefaultedField("Usage", "" );
            sql.addDefaultedField("CryptoAddress", "Address",   "");
            sql.addField("Description");
            sql.setOrderBy("TXNCreated DESC, Timestamp, Line");
            
            if (filter.length() != 0) sql.addAnd(filter);
            
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
            
            sql.setFrom("CurrentAccount A JOIN Bank B ON  A.Bank = B.Code");
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
            Date    timestamp = ctx.getTimestamp("date",  "time");
            Date    completed = ctx.getTimestamp("cdate", "ctime");
            String  txnId     = ctx.getParameter("txnid");
            String  line      = ctx.getParameter("line");
            String  txnDesc   = ctx.getParameter("tdescription");
            boolean txnUpdate = true;
            
            ctx.getAppDb().startTransaction();
            
            if (line.length() != 0) {
                ResultSet rs;
                SQLSelectBuilder sql = ctx.getSelectBuilder("TransactionLine");
                
                sql.addField("TXNId");
                sql.addField("Line");
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
                sql.addAnd("TXNId", "=", txnId, true);
                sql.addAnd("Line",  "=", line,  false);
                rs = ctx.getAppDb().updateQuery(sql.build());
                    
                if (!rs.next())
                    ctx.getReplyBuffer().append("No record for TXN " + txnId + ":" + line);
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
                    rs.updateString("Description",   ctx.getParameter("pdescription"));
                    rs.updateRow();
                }
            } else {
                if (txnId.length() == 0) {
                    txnId     = createTransaction(ctx, timestamp, txnDesc);
                    txnUpdate = false;
                    ctx.getReplyBuffer().append("TXNId=" + txnId);
                }                    
                addTransactionLine(ctx, timestamp, completed, "p", txnId);
                addTransactionLine(ctx, timestamp, completed, "s", txnId);          
            }
            if (txnUpdate) {
                SQLUpdateBuilder sqlu = ctx.getUpdateBuilder("TransactionHeader");
                sqlu.addField("Description", txnDesc);
                sqlu.addAnd("txnId",       "=",  txnId);
                sqlu.addAnd("Description", "!=", txnDesc);            
                executeUpdate(ctx, sqlu);
            }
            ctx.getAppDb().commit();
            ctx.setStatus(200);
        } else if (action.equals("delete")) {
            ctx.getAppDb().startTransaction();
            SQLDeleteBuilder sql = ctx.getDeleteBuilder("TransactionLine");
            
            sql.addAnd("TXNId", "=", ctx.getParameter("txnid"), true);
            sql.addAnd("Line",  "=", ctx.getParameter("line"),  false);
            executeUpdate(ctx, sql.build());
            ctx.getAppDb().commit();            
            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid"); 
        }
    }
}
