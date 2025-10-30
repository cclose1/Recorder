/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package org.cbc;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Date;
import java.util.TimeZone;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.json.JSONValue;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;

/**
 *
 * @author chris
 */
public class ChartBuilder extends ApplicationServer {
    private void  addHdrField(JSONArray hdr, String field, String type) throws JSONException {        
        JSONObject mbr;
        
        mbr = hdr.addObject();
        mbr.add("Name", new JSONValue(field));  
        mbr.add("Type", new JSONValue(type));       
    }
    private JSONObject getSourceFields(Context ctx, String exclude) throws SQLException, JSONException {  
        ResultSet         rs;
        JSONObject.DBRow  md;
        JSONObject        source = new JSONObject();
        JSONArray         hdr    = new JSONArray();
        JSONArray         rows   = new JSONArray();
        String[]          ignore = exclude.split(",");
     
        SQLSelectBuilder sel;
        Arrays.asList(ignore).contains("modifier");
        ctx.changeAppDatabase(ctx.getParameter("Database"));
        
        sel = ctx.getSelectBuilder(ctx.getParameter("Source"));
        sel.addField("*");
        sel.setMaxRows(1);
        rs = ctx.getAppDb().executeQuery(sel.build());
        md = new JSONObject.DBRow(rs);
        md.nextRow();
        source.add("Table",  new JSONValue(md.getTableName()));
        source.add("Header", hdr);
        
        addHdrField(hdr, "Name",  "varchar");
        addHdrField(hdr, "Index", "int");        
        addHdrField(hdr, "Type",  "varchar");
        
        source.add("Data",   rows);
        
        for (int i = 1; i <= md.getColumnCount(); i++) {
            JSONArray row = rows.addArray();
                        
            md.setColumn(i);
            
            if (Arrays.asList(ignore).contains(md.getName())) continue;
            
            row.add(new JSONValue(md.getName()));
            row.add(new JSONValue(i - 1));
            row.add(new JSONValue(md.getType()));
        }
        ctx.restoreAppDatabase();
        
        return source;
    }
    private ResultSet getChart(Context ctx, String chartPar) throws SQLException {     
        SQLSelectBuilder sel;
        
        sel = ctx.getSelectBuilder("Chart");
        sel.addField("*");
        sel.addAnd("Name", "=", ctx.getParameter(chartPar));
        
        return ctx.getAppDb().executeQuery(sel.build());
    }
    private void loadChart(Context ctx) throws SQLException, JSONException, ParseException {  
        SQLSelectBuilder sel = ctx.getSelectBuilder("Chart");
        ResultSet        rs;
        JSONObject       json        = new JSONObject();
        
        sel.addField("*");
        
        sel.addAnd("Name", "=", ctx.getParameter("Chart"));
        rs = ctx.getAppDb().executeQuery(sel.build());
        
        if (!rs.next()) errorExit("Chart " + ctx.getParameter("Chart") + " does not exists");
                
        json.add("Title",    rs.getString("Title"));
        json.add("Database", rs.getString("Database"));        
        json.add("Source",   rs.getString("DataSource"));
        json.add("XColumn",  rs.getString("XColumn"));

        sel.clear();        
        sel = new SQLSelectBuilder("ChartDefinition", ctx.getAppDb().getProtocol());
        sel.addField("*");
        sel.addAnd("Chart", "=", ctx.getParameter("Chart"));
        sel.addOrderByField("PartType",  false);
        sel.addOrderByField("PartIndex", false);
        sel.addOrderByField("PartName",  false);
        rs = ctx.getAppDb().executeQuery(sel.build());
        json.add("Defs", new JSONObject()).add("Definition", rs);       
        json.append(ctx.getReplyBuffer());
    }
    
    private void getChartData(Context ctx) throws SQLException, ParseException, JSONException, IOException {
        String           database  = ctx.getParameter("Database");
        String           table     = ctx.getParameter("Source");
        
        SQLSelectBuilder sql;
        Date             start     = ctx.getTimestamp("Start");  
        Date             end       = ctx.getTimestamp("End");
        JSONObject       data      = new JSONObject();
        String           group     = ctx.getParameter("GroupBy", "");
        String[]         fields    = ctx.getParameter("Fields",  "").split(",");
        String           xField    = null;
        boolean          useGMT    = ctx.getBoolean("UseGMT", false);
        ResultSet        rs;
        
        if (useGMT) {            
            start = timeWithDate.toGMT(start);
            end   = timeWithDate.toGMT(end);
        }
        ctx.changeAppDatabase(database);
        sql = ctx.getSelectBuilder(table);
        
        for (String field : fields) {
            String[] pars = field.split(":");
            /*
             * There are up to 3 parameters, the final 2 being optional. The parameters are:
             *  - name   The database column name providing the source value.
             *  - agg    The aggregate function to be used in the case of group by. Defaults to sum.
             *  - alias  The field
             */
            if (xField == null) xField = pars[0];
            
            if (group.length() == 0) {
                if (pars.length == 3)
                    sql.addField(pars[2], pars[0]);
                else
                    sql.addField(pars[0]);
            } else {
                String name  = pars[0];
                String aggr  = pars.length >= 2? pars[1] : xField.equals(pars[0])? "Min" : "Sum";
                String alias = pars.length == 3? pars[2] : name;
                
                sql.addField(alias, aggr + "(" + name + ")");
            }
        }
        sql.addAnd("!" + xField, ">=", start);
        sql.addAnd("!" + xField,  "<", end);
        sql.addAnd(ctx.getParameter("filter"));
        sql.addOrderByField(xField, false);
        
        for (String field : group.split("\\|")) {
            if (!field.equals("")) sql.addGroupByField(field);
        }        
        rs = ctx.getAppDb().executeQuery(sql.build());
        data.add("ChartData", rs, useGMT);
        data.append(ctx.getReplyBuffer());
    }
    
    private void createChart(Context ctx, String action) throws SQLException, JSONException, ParseException { 
        JSONObject       data;
        ResultSet        rs;
        
        rs = getChart(ctx, "Name");
        
        if (rs.next()) errorExit("Chart " + ctx.getParameter("Name") + " already exists");
        
        if (action.equals("Create")) {
            SQLInsertBuilder ins = ctx.getInsertBuilder("Chart");
            
            ins.addField("Name",       ctx.getParameter("Name"));
            ins.addField("Title",      ctx.getParameter("Title"));
            ins.addField("Database",   ctx.getParameter("Database"));
            ins.addField("DataSource", ctx.getParameter("Source"));
            ins.addField("XColumn",    ctx.getParameter("XColumn"));
            ins.addField("Valid",      "N");          
            ctx.getAppDb().executeUpdate(ins.build());          
        } else {
            data = getSourceFields(ctx, "Modified,Comment");
            data.append(ctx.getReplyBuffer());
        }
    }
    @Override
    public String getVersion() {
        return "V1.0 Released 21-Sep-25";
    }

    @Override
    public void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {
           databases.setApplication(
                super.config.getProperty("endatabase"),
                super.config.getProperty("enuser"),
                super.config.getProperty("enpassword"));
    }
    @Override
    public void processAction(
            Context ctx,
            String action) throws ServletException, IOException, SQLException, JSONException, ParseException { 
        /*
         * The following is necessary as the default appears to be BST. 
         *
         * Without this date strings are converted to GMT when creating the Date object, so 20-Aug-24 00:30:00 
         * becomes 19-Aug-24 23:30:00. Usually this does not matter as on output is converted to BST format and
         * the result is consistent the front end or the database point of view.
         *
         * However, this code takes action on when the day changes, e.g. when 19-Aug-24 23:30:00 changes to
         * 20-Aug-24 00:30:00. Without the following, day change is only triggered on the date 20-Aug-24 01:00:00.
         */        
        TimeZone.setDefault(TimeZone.getTimeZone("GMT"));
        
        switch (action) {
            case "Create":
            case "LoadSource":
                createChart(ctx, action);
                break;
            case "LoadChart":
                loadChart(ctx);
                break;
            case "Update":
                break;
            case "ChartData":
                getChartData(ctx);
                break;
            default:
                invalidAction();
                break;
        }
        ctx.getAppDb().commit();
        ctx.setStatus(200);
    }

    
}
