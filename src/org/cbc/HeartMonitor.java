/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Date;
import java.util.Hashtable;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.json.JSONReader;
import org.cbc.json.JSONValue;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLNamedValues;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;

/**
 *
 * @author Chris
 */
@WebServlet(name = "NewServletz", urlPatterns = {"/NewServletz"})
public class HeartMonitor extends ApplicationServer {
    public String getVersion() {
        return "V1.4 Released 30-Nov-20";    
    }
    private String getOrientation(Context ctx, String field) throws SQLException {
        SQLSelectBuilder sql = ctx.getSelectBuilder("MeasureOrientation");
        
        if (field == null || field.trim().length() == 0) return null;
        
        sql.addField("Id");
        sql.addAnd("Orientation", "=", field);
        
        ResultSet rs = ctx.getAppDb().executeQuery(sql.build());
        
        return rs.next()? rs.getString("Id") : null;
    }    
    private String getMemberValue(JSONArray row,  Hashtable<String, Integer> index, String id) throws JSONException {
        return row.get(index.get(id).intValue()).getString();
    }
    private void applyJSONUpdate(Context ctx, String table, String user, Hashtable<String, Integer> index, JSONArray row) throws JSONException, ParseException, SQLException {
        ResultSet      rs   = null;
        SQLNamedValues nv      = new SQLNamedValues();
        Date           time    = DateFormatter.parseDate(getMemberValue(row, index, "Time"));
        Date           session = DateFormatter.parseDate(getMemberValue(row, index, "Session"));
        String         side    = getMemberValue(row, index, "Side");
        
        nv.add("Individual", user, "=");
        nv.add("Timestamp",  time, "=");
        nv.add("Side",       side, "=");
        
        if (exists(ctx, table, nv)) {  
            SQLUpdateBuilder sql = ctx.getUpdateBuilder(table);
            
            sql.addAnd(nv);
            sql.addField("Individual",  user);
            sql.addField("Timestamp",   time);
            sql.addField("Side",        side);
            sql.addField("Session",     session);
            sql.addField("Systolic",    getMemberValue(row, index, "Systolic"));
            sql.addField("Diastolic",   getMemberValue(row, index, "Diastolic"));
            sql.addField("Pulse",       getMemberValue(row, index, "Pulse"));
            sql.addField("Orientation", getOrientation(ctx, getMemberValue(row, index, "Orientation")));
            sql.addField("Comment",     getMemberValue(row, index, "Comment"));
           
            executeUpdate(ctx, sql);   
        } else {            
            rs = ctx.getAppDb().insertTable(table);
            rs.moveToInsertRow();
            
            rs.updateString("Individual",   user);
            rs.updateTimestamp("Session",   ctx.getSQLTimestamp(session));
            rs.updateTimestamp("Timestamp", ctx.getSQLTimestamp(time));
            rs.updateString("Side",         side);
            rs.updateString("Systolic",     getMemberValue(row, index, "Systolic"));
            rs.updateString("Diastolic",    getMemberValue(row, index, "Diastolic"));
            rs.updateString("Pulse",        getMemberValue(row, index, "Pulse"));
            rs.updateString("Orientation",  getOrientation(ctx, getMemberValue(row, index, "Orientation")));
            rs.updateString("Comment",      getMemberValue(row, index, "Comment"));
            rs.insertRow();            
            rs.close();
        }
    }
    public void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {       
        databases.setApplication(
                super.config.getProperty("bpdatabase"),
                super.config.getProperty("bpuser"),
                super.config.getProperty("bppassword"));
    }    
    public void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        String table = "Measure";
        
        if (action.equals("save")) {
            ResultSet rs = ctx.getAppDb().insertTable(table);
            rs.moveToInsertRow();
            
            rs.updateString("Individual",   ctx.getParameter("identifier"));
            rs.updateTimestamp("Session",   ctx.getSQLTimestamp(ctx.getTimestamp("session")));
            rs.updateTimestamp("Timestamp", ctx.getSQLTimestamp(ctx.getTimestamp("timestamp")));
            rs.updateString("Side",         ctx.getParameter("side"));
            rs.updateString("Systolic",     ctx.getParameter("systolic"));
            rs.updateString("Diastolic",    ctx.getParameter("diastolic"));
            rs.updateString("Pulse",        ctx.getParameter("pulse"));
            rs.updateString("Orientation",  getOrientation(ctx, ctx.getParameter("orientation")));
            rs.updateString("Comment",      ctx.getParameter("comment"));
            rs.insertRow();
            rs.close();
            ctx.setStatus(200);
        } else if (action.equals("delete")) { 
            SQLDeleteBuilder sql = ctx.getDeleteBuilder(table);
            
            sql.addAnd("Individual", "=", ctx.getParameter("ukindividual"));
            sql.addAnd("Timestamp",  "=", ctx.getSQLTimestamp("uktimestamp"));
            sql.addAnd("Side",       "=", ctx.getParameter("ukside"));
            executeUpdate(ctx, sql.build());
            ctx.setStatus(200);
        } else if (action.equals("modify")) {     
            SQLUpdateBuilder sql = ctx.getUpdateBuilder(table);
            
            String kIndividual = ctx.getParameter("ukindividual");
            Date   kTimestamp  = ctx.getTimestamp("uktimestamp");
            String kSide       = ctx.getParameter("ukside");
            
            sql.addAnd("Individual", "=", kIndividual);
            sql.addAnd("Timestamp",  "=", kTimestamp);
            sql.addAnd("Side",       "=", kSide);
            
            sql.addField("Individual",  ctx.getParameter("uindividual"));
            sql.addField("Timestamp",   ctx.getParameter("utimestamp"));
            sql.addField("Side",        ctx.getParameter("uside"));
            sql.addField("Session",     ctx.getParameter("usession"));
            sql.addField("Systolic",    ctx.getParameter("usystolic"));
            sql.addField("Diastolic",   ctx.getParameter("udiastolic"));
            sql.addField("Pulse",       ctx.getParameter("upulse"));
            sql.addField("Orientation", getOrientation(ctx, ctx.getParameter("uorientation")));
            sql.addField("Comment",     ctx.getParameter("ucomment"));
            
            try {
                executeUpdate(ctx, sql);   
                ctx.setStatus(200);             
            } catch (SQLException e) {
                if (ctx.getAppDb().getStandardError(e) == DatabaseSession.Error.Duplicate) {
                    ctx.getReplyBuffer().append("Change duplicates primary key");
                    ctx.setStatus(200);            
                } else
                    throw e;
            }
        } else if (action.equals("getList")) {
            getList(ctx);
        } else if (action.equals("history")) {
            JSONObject       data = new JSONObject();            
            SQLSelectBuilder  sql = ctx.getSelectBuilder(null);

            sql.setProtocol(ctx.getAppDb().getProtocol());
            sql.setMaxRows(config.getIntProperty("topmeasures", 100));

            sql.addField("Individual");
            
            if (sql.getProtocol().equalsIgnoreCase("sqlserver")) {
                sql.addField("Date");
                sql.addField("Week", sql.setCast("DECIMAL", 2));
                sql.addField("Weekday");
            } else {
                sql.addField("Date",    sql.setFieldSource("Timestamp"), sql.setCast("Date"));
                sql.addField("Week",    sql.setExpressionSource("Week(Timestamp) + 1"), sql.setCast("DECIMAL", 2));
                sql.addField("Weekday", sql.setExpressionSource("SubStr(DayName(Timestamp), 1, 3)"));
            }
            sql.addField("Session");
            sql.addField("Timestamp", sql.setCast("Datetime"));             
            sql.addField("Side");
            sql.addField("Systolic");
            sql.addField("Diastolic");
            sql.addField("Pulse");
            sql.addField("Orientation", sql.setFieldSource("O.Orientation"), sql.setValue(""));
            sql.addField("Comment");
            sql.setOrderBy("Timestamp DESC");
            
            sql.setFrom("Measure AS M LEFT JOIN MeasureOrientation AS O ON M.Orientation = O.Id");

            sql.addAnd("Individual", "=", ctx.getParameter("identifier"));

            ResultSet rs = executeQuery(ctx, sql);
            
            data.add("PressureHistory", rs, super.config.getProperty("bpoptionalcolumns"), false);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("updates")) {
            Hashtable<String, Integer> index   = new Hashtable<>(0);        
            String                     user    = ctx.getParameter("user");
            JSONValue                  data    = JSONValue.load(new JSONReader(ctx.getParameter("updates")));
            JSONArray                  columns = data.getObject().get("Header").getArray();            
            JSONArray                  rows    = data.getObject().get("Data").getArray();
            /*
             * Build an index to link the column header names to the corresponding row column.
             */
            for (int i = 0; i < columns.size(); i++) {
                index.put(columns.get(i).getObject().get("Name").getString(), new Integer(i));
            }
            
            for (int i = 0; i < rows.size(); i++) {
                JSONArray row = rows.get(i).getArray();
                
                applyJSONUpdate(ctx, table, user, index, row);
            }
            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid"); 
        }
    }
}
