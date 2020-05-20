/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import org.cbc.sql.SQLSelectBuilder;
import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Date;
import java.util.Properties;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.application.reporting.Report;
import org.cbc.application.reporting.Trace;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.utils.system.Calendar;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public class RecordSpend extends ApplicationServer { 

    private class Configuration {        
        Properties properties = new Properties();
                
        private String  readTable;
        private String  updateTable;
        private String  optionalColumns;
        
        private int getIntProperty(String name, int defaultValue) {
            String value = properties.getProperty(name);
            
            if (value == null) return defaultValue;
            
            try {
                return Integer.parseInt(value);
            } catch (NumberFormatException ex) {
                Report.error(null, "Property " + name + " value=" + value + " is not an integer defaulting to " + defaultValue);
            }        
            return defaultValue;
        }
        public void load(ServletConfig config, ApplicationServer.Configuration.Databases dbs) throws IOException {
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            readTable       = properties.getProperty("spendreadtable");
            updateTable     = properties.getProperty("spendupdatetable");
            optionalColumns = properties.getProperty("spendoptionalcolumns");
            dbs.setApplication(
                    properties.getProperty("sddatabase"), 
                    properties.getProperty("sduser"), 
                    properties.getProperty("sdpassword"));
        }
        public String getReadTable() {
            return readTable;
        }
        public String getUpdateTable() {
            return updateTable;
        }
        public String getOptionalColumns() {
            return optionalColumns;
        }
    }
    Configuration config = new Configuration();
        
    private void setDataFields(
            ResultSet rs,  
            java.sql.Timestamp date,
            String             category,
            String             type,
            String             location,
            String             description,
            String             amount,
            String             payment,
            String             period,
            String             bankcorrection) throws SQLException {        
        rs.updateTimestamp("Timestamp", date);
        rs.updateString("Category",       category);
        rs.updateString("Type",           type);
        rs.updateString("Location",       location);
        rs.updateString("Description",    description);
        rs.updateString("Amount",         amount);
        rs.updateString("Payment",        payment);
        rs.updateString("Period",         period.length() == 0? null : period);
        rs.updateString("BankCorrection", bankcorrection.length() == 0? "0" : bankcorrection);
    }    
    private void setDataFields(Context ctx, ResultSet rs, Date date) throws SQLException {
        setDataFields(
                rs,
                ctx.getSQLTimestamp(date),
                ctx.getParameter("category"),
                ctx.getParameter("type"),
                ctx.getParameter("location"),
                ctx.getParameter("description"),
                ctx.getParameter("amount"),
                ctx.getParameter("payment"),
                ctx.getParameter("period"),
                ctx.getParameter("bankcorrection"));
    }
    /*
     * Copies the monthly fields for year and month in Date which defaults to todays date if null.
     * If there are already monthly fields for year and month no action is taken as they have already been copied.
     *
     * The monthly fields from the previous month are copied adding 1 to the month of the timestamp field.
     *
     * This could be done using a single insert select statement. However, adding a month to a DATETIME field differs
     * for each database. The code in this routine should work for all databases.
     */
    private void copyFixed(Context ctx, String read, String update, Date date, String period) throws SQLException {
        Trace t = new Trace("copyFixed");
        
        SQLSelectBuilder sel       = new SQLSelectBuilder(read);
        Calendar         cal       = new Calendar();
        int              count     = 0;
        int              increment = period.equalsIgnoreCase("Y")? 12 : 1;
        ResultSet rsi;
      
        if (date != null) cal.setTime(date);
        
        sel.addAnd("Year",   "=", cal.getYear());
        sel.addAnd("Month",  "=", cal.getMonth());
        sel.addAnd("Period", "=", period);
        sel.addField("Count", sel.setExpressionSource("Count(*)"));
        ResultSet rsr   = executeQuery(ctx, sel);
        
        if (rsr.next()) count = rsr.getInt("Count");
        
        rsr.close();
        t.report('r', "Count " + count);
        
        if (count == 0) {
            cal.incrementMonth(-increment);
            sel.clearFields();
            sel.clearWhere();
            sel.addField("Timestamp");
            sel.addField("IncurredBy");
            sel.addField("Category");
            sel.addField("Type");
            sel.addField("Location");
            sel.addField("Description");
            sel.addField("Amount");
            sel.addField("Period");
            sel.addField("Payment");
            sel.addField("BankCorrection");
            sel.addAnd("Year",   "=", cal.getYear());
            sel.addAnd("Month",  "=", cal.getMonth());
            sel.addAnd("Period", "=", period);
            t.report('r', "Copy period " + period + " year " + cal.getYear() + " month "  + cal.getMonth());
            rsr = executeQuery(ctx, sel);
        
            rsi = ctx.getAppDb().insertTable(update);
            
            while (rsr.next()) {
                cal.setTime(rsr.getTimestamp("Timestamp").getTime());
                cal.incrementMonth(increment);
                rsi.moveToInsertRow();
                rsi.updateString("IncurredBy", rsr.getString("IncurredBy"));
                rsi.updateString("Period",     period);
                setDataFields (
                        rsi,
                        ctx.getSQLTimestamp(cal.getTime()),
                        rsr.getString("Category"),
                        rsr.getString("Type"),
                        rsr.getString("Location"),
                        rsr.getString("Description"),
                        rsr.getString("Amount"),
                        rsr.getString("Payment"),
                        rsr.getString("Period"),
                        rsr.getString("BankCorrection"));
                rsi.insertRow();
            }
        }
        t.exit();
    }
    public String getVersion() {        
        return "V2.2 Released 05-Dec-18";    
    }
    public void initApplication (ServletConfig config, ApplicationServer.Configuration.Databases databases) throws ServletException, IOException {
        this.config.load(config, databases);        
    }
    public void processAction(
            Context ctx,
            String  action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        boolean mySql  = ctx.getAppDb().getProtocol().equals("mysql");
        
        if (action.equals("deletespend")) {
            SQLDeleteBuilder sql = ctx.getDeleteBuilder(config.getUpdateTable());
            
            sql.addAnd("SeqNo", "=", ctx.getParameter("seqno"), false);
            executeUpdate(ctx, sql.build());
            ctx.setStatus(200);
        } else if (action.equals("savespend")) {
            String    seqNo = ctx.getParameter("seqno");            
            Date      date  = ctx.getTimestamp("date", "time");
            ResultSet rs;
               
            if (seqNo.length() == 0) {
                rs = ctx.getAppDb().insertTable(config.getUpdateTable());
                rs.moveToInsertRow();
                setDataFields(ctx, rs, date);
                rs.insertRow();
                ctx.setStatus(200);
            } else {
                SQLSelectBuilder sql = ctx.getSelectBuilder(config.getUpdateTable());
                
                sql.addField("SeqNo");
                sql.addField("Timestamp");
                sql.addField("Category");
                sql.addField("Type");
                sql.addField("Description");
                sql.addField("Location");
                sql.addField("Amount");
                sql.addField("Payment");
                sql.addField("Period");
                sql.addField("BankCorrection");
                sql.addAnd("SeqNo", "=", seqNo, false);
                rs = ctx.getAppDb().updateQuery(sql.build());
                    
                if (!rs.next())
                    ctx.getReplyBuffer().append("No record for SeqNo " + seqNo);
                else {
                    rs.moveToCurrentRow();
                    setDataFields(ctx, rs, date);
                    rs.updateRow();
                    ctx.setStatus(200);
                }
            }
            ctx.getAppDb().commit();
        } else if (action.equals("spendhistory")) { 
            JSONObject      data = new JSONObject();
            SQLSelectBuilder sql = ctx.getSelectBuilder(config.getReadTable());
                
            copyFixed(ctx, config.getReadTable(), config.getUpdateTable(), null, "M");
            copyFixed(ctx, config.getReadTable(), config.getUpdateTable(), null, "Y");
            sql.setMaxRows(config.getIntProperty("spendhistoryrows", 100));
            sql.addField("SeqNo");
            sql.addField("Timestamp");
            sql.addField("Weekday");
            sql.addField("Category",    sql.setCast("VARCHAR", 13));
            sql.addField("Type",        sql.setCast("VARCHAR", 13));
            sql.addField("Description", sql.setValue(""));
            sql.addField("Location",    sql.setValue(""));
            sql.addField("Period");
            sql.addField("Payment");
            sql.addField("Amount",      sql.setCast("DECIMAL", 10, 2));
            sql.addField("Correction",  sql.setExpressionSource("BankCorrection"),  sql.setCast("DECIMAL", 10, 2));
            sql.addAnd(ctx.getParameter("filter"));
            sql.setOrderBy("Timestamp DESC");
            ResultSet rs = executeQuery(ctx, sql);
            data.add("SpendData", rs, config.getOptionalColumns());
            data.append(ctx.getReplyBuffer());
            ctx.setStatus(200);
        } else if (action.equals("getList")) {
            getList(ctx);
        } else if (action.equals("getListo")) {
            JSONObject       data     = new JSONObject();
            String           field    = ctx.getParameter("field");
            String           category = ctx.getParameter("category");
            String           type     = ctx.getParameter("type");
            SQLSelectBuilder sql;
            
            if (category != null && category.length() == 0) {
                category = null;
            }
            if (type != null && type.length() == 0) {
                type = null;
            }
            if (category == null && type == null) {
                sql =  ctx.getSelectBuilder("ListValues");
                sql.addField("Value");
                sql.addAnd("Type", "=", field);
                sql.setOrderBy("Value");
            } else {
                sql = ctx.getSelectBuilder("SpendData");
                sql.setOptions("DISTINCT");
                sql.addField(field);
                sql.setWhere(field + " IS NOT NULL");

                if (category != null) {
                    sql.addAnd("Category", "=", category);
                }
                if (type != null) {
                    sql.addAnd("Type", "=", type);
                }
                sql.setOrderBy(field);
            }
            ResultSet rs = executeQuery(ctx, sql.build());

            data.add(field, rs);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("summaryfields")) {
            String     sql    = mySql? "CALL Summary(NULL, NULL, 'Y')" : "EXEC Summary NULL, NULL";
            JSONArray  fields = new JSONArray();
            String     named  = ctx.getParameter("name");
            ResultSet  rs     = executeQuery(ctx, sql);

            fields.addFields(rs);

            if (named == null || named.length() == 0) {
                fields.append(ctx.getReplyBuffer());
            } else {
                JSONObject data = new JSONObject();

                data.add(named, fields);
                data.append(ctx.getReplyBuffer());
            }
            ctx.setStatus(200);
        } else if (action.equals("checktimestamp")) {
            String           seqNo     = ctx.getParameter("seqno");
            Date             timestamp = ctx.getTimestamp("date", "time");
            SQLSelectBuilder sql       = ctx.getSelectBuilder(config.getUpdateTable());
            
            sql.addField("SeqNo");
            sql.addAnd("Timestamp", "=", timestamp);
            
            ResultSet rs = executeQuery(ctx, sql.build());

            if (rs.next() && !seqNo.equals(rs.getString("SeqNo"))) {
                ctx.getReplyBuffer().append("Change time as details already recorded for " + timestamp);
            }
            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid");
        }
    }
}
