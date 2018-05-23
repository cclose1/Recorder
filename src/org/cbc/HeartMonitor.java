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
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;

/**
 *
 * @author Chris
 */
@WebServlet(name = "NewServletz", urlPatterns = {"/NewServletz"})
public class HeartMonitor extends ApplicationServer {
    public String getVersion() {
        return "V1.2 Released 16-Jan-2017";    
    }
    private String getOrientation(Context ctx, String field) throws SQLException {
        String           value = ctx.getParameter(field);
        SQLSelectBuilder sql   = ctx.getSelectBuilder("MeasureOrientation");
        
        if (value == null || value.trim().length() == 0) return null;
        
        sql.addField("Id");
        sql.addAnd("Orientation", "=", value);
        
        ResultSet rs = ctx.getAppDb().executeQuery(sql.build());
        
        return rs.next()? rs.getString("Id") : null;
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
            rs.updateString("Orientation",  getOrientation(ctx, "orientation"));
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
            sql.addField("Orientation", getOrientation(ctx, "uorientation"));
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
                sql.addField("Week");
                sql.addField("Weekday");
            } else {
                sql.addField("CAST(Timestamp AS Date)",          "Date");
                sql.addField("Week(Timestamp) + 1",              "Week");
                sql.addField("SubStr(DayName(Timestamp), 1, 3)", "Weekday");
            }
            sql.addField("Session");
            sql.addField("CAST(Timestamp AS Datetime)", "Timestamp");                
            sql.addField("Side");
            sql.addField("Systolic");
            sql.addField("Diastolic");
            sql.addField("Pulse");
            sql.addDefaultedField("O.Orientation", "Orientation", "");
            sql.addField("Comment");
            sql.setOrderBy("Timestamp DESC");
            
            sql.setFrom("Measure AS M LEFT JOIN MeasureOrientation AS O ON M.Orientation = O.Id");

            sql.addAnd("Individual", "=", ctx.getParameter("identifier"));

            ResultSet rs = executeQuery(ctx, sql);
            
            data.add("PressureHistory", rs, super.config.getProperty("bpoptionalcolumns"), false);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid"); 
        }
    }
}
