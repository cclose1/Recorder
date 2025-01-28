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
import org.cbc.sql.SQLNamedValues;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.system.DateFormatter;

/**
 *
 * @author Chris
 */
@WebServlet(name = "NewServletz", urlPatterns = {"/NewServletz"})
public class HeartMonitor extends ApplicationServer {
    @Override
    public String getVersion() {
        return "V1.5 Released 14-Jan-25";    
    }
    private String getOrientation(Context ctx, String field) throws SQLException {
        SQLSelectBuilder sql = ctx.getSelectBuilder("MeasureOrientation");
        
        if (field == null || field.trim().length() == 0) return null;
        
        sql.addField("Id");
        sql.addAnd("Orientation", "=", field);
        
        ResultSet rs = ctx.getAppDb().executeQuery(sql.build());
        
        if (!rs.next()) throw new SQLException("Orientation " + field + " not found");
        
        return rs.getString("Id");
    }    
    private String getMemberValue(JSONArray row,  HashMap<String, Integer> index, String id) throws JSONException {
        return row.get(index.get(id)).getString();
    }
    private boolean applyJSONUpdate(Context ctx, String table, String user, HashMap<String, Integer> index, JSONArray row) throws JSONException, ParseException, SQLException {
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
            
            return false;
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
            
            return true;
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
    protected String updateParameter(Context ctx, String name, String value) {
        try {
            return name.endsWith("rientation")? getOrientation(ctx, value) : value;
        } catch (Exception ex) {
            errorExit("updateParameter " + name + "-failed with exception:" + ex.getMessage());
        }
        return null;
    }
    @Override
    public void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        String     table = "Measure";
        JSONObject data  = new JSONObject();
        ResultSet  rs;
        
        switch (action) {
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
                int                      inserts = 0;
                int                      updates = 0;
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

                    if (applyJSONUpdate(ctx, table, user, index, row))
                        inserts += 1;
                    else
                        updates += 1;
                }
                ctx.setStatus(200);
                ctx.getReplyBuffer().append("Inserts ").append(inserts).append(" Updates ").append(updates);
                break;
            }
            default:
                invalidAction();
                break; 
        }
    }
}
