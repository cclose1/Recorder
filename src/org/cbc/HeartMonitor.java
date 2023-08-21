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
import java.util.HashMap;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.json.JSONReader;
import org.cbc.json.JSONValue;
import org.cbc.sql.SQLBuilder;
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
    private String getMemberValue(JSONArray row,  HashMap<String, Integer> index, String id) throws JSONException {
        return row.get(index.get(id)).getString();
    }
    private void applyJSONUpdate(Context ctx, String table, String user, HashMap<String, Integer> index, JSONArray row) throws JSONException, ParseException, SQLException {
        ResultSet      rs;
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
    @Override
    public void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {       
        databases.setApplication(
                super.config.getProperty("bpdatabase"),
                super.config.getProperty("bpuser"),
                super.config.getProperty("bppassword"));
    }    
    @Override
    public void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        String     table = "Measure";
        JSONObject data  = new JSONObject();
        ResultSet  rs;
        SQLBuilder sqlb;
        
        switch (action) {
            case "save": {
                rs = ctx.getAppDb().insertTable(table);
                rs.moveToInsertRow();
                rs.updateString("Individual",    ctx.getParameter("identifier"));
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
                break;
            }
            case "delete": {
                sqlb = ctx.getDeleteBuilder(table);
                sqlb.addAnd("Individual", "=", ctx.getParameter("ukindividual"));
                sqlb.addAnd("Timestamp",  "=", ctx.getSQLTimestamp("uktimestamp"));
                sqlb.addAnd("Side",       "=", ctx.getParameter("ukside"));
                executeUpdate(ctx, sqlb.build());
                ctx.setStatus(200);
                break;
            }
            case "modify": {
                String kIndividual = ctx.getParameter("ukindividual");
                Date   kTimestamp  = ctx.getTimestamp("uktimestamp");
                String kSide       = ctx.getParameter("ukside");
                
                sqlb = ctx.getUpdateBuilder(table);
                sqlb.addAnd("Individual", "=", kIndividual);
                sqlb.addAnd("Timestamp",  "=", kTimestamp);
                sqlb.addAnd("Side",       "=", kSide);
                
                sqlb.addField("Individual",  ctx.getParameter("uindividual"));
                sqlb.addField("Timestamp",   ctx.getParameter("utimestamp"));
                sqlb.addField("Side",        ctx.getParameter("uside"));
                sqlb.addField("Session",     ctx.getParameter("usession"));
                sqlb.addField("Systolic",    ctx.getParameter("usystolic"));
                sqlb.addField("Diastolic",   ctx.getParameter("udiastolic"));
                sqlb.addField("Pulse",       ctx.getParameter("upulse"));
                sqlb.addField("Orientation", getOrientation(ctx, ctx.getParameter("uorientation")));
                sqlb.addField("Comment",     ctx.getParameter("ucomment"));
                
                try {
                    executeUpdate(ctx, sqlb);
                    ctx.setStatus(200);
                } catch (SQLException e) {
                    if (ctx.getAppDb().getStandardError(e) == DatabaseSession.Error.Duplicate) {
                        ctx.getReplyBuffer().append("Change duplicates primary key");
                        ctx.setStatus(200);
                    } else {
                        throw e;
                    }
                }
                break;
            }
            case "getList":
                getList(ctx);
                break;
            case "history": {
                SQLSelectBuilder sql  = ctx.getSelectBuilder(null);
                
                sql.setProtocol(ctx.getAppDb().getProtocol());
                sql.setMaxRows(config.getIntProperty("topmeasures", 100));
                sql.addField("Individual");
                sql.addField("Date");
                sql.addField("Week", sql.setCast("DECIMAL", 2));
                sql.addField("Weekday");
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
                rs = executeQuery(ctx, sql);
                data.add("PressureHistory", rs, super.config.getProperty("bpoptionalcolumns"), false);
                data.append(ctx.getReplyBuffer());
                ctx.setStatus(200);
                break;
            }
            case "updates": {
                HashMap<String, Integer> index   = new HashMap<>(0);
                String                   user    = ctx.getParameter("user");
                JSONValue                value   = JSONValue.load(new JSONReader(ctx.getParameter("updates")));
                JSONArray                columns = value.getObject().get("Header").getArray();
                JSONArray                rows    = value.getObject().get("Data").getArray();
                /*
                 * Build an index to link the column header names to the corresponding row column.
                 */
                for (int i = 0; i < columns.size(); i++) {
                    index.put(columns.get(i).getObject().get("Name").getString(), i);
                }
                for (int i = 0; i < rows.size(); i++) {
                    JSONArray row = rows.get(i).getArray();

                    applyJSONUpdate(ctx, table, user, index, row);
                }
                ctx.setStatus(200);
                break;
            }
            default:
                ctx.dumpRequest("Action " + action + " is invalid");
                ctx.getReplyBuffer().append("Action ").append(action).append(" is invalid");
                break; 
        }
    }
}
