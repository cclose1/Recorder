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
import java.util.Iterator;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.utils.data.DatabaseSession;
/**
 *
 * @author chris
 */
public class CarUsage extends ApplicationServer {
    private void log(Context ctx, String action) throws SQLException, ParseException {
        SQLBuilder sql = ctx.getInsertBuilder("ChargeSessionLog");

        if (!ctx.getParameter("logupdates").equalsIgnoreCase("true")) return;
            
        sql.addField("CarReg",  ctx.getParameter("CarReg"));
        sql.addField("Session", ctx.getTimestamp("Start"));
        
        switch (action) {
            case "deleteTableRow":
                sql = ctx.getDeleteBuilder("ChargeSessionLog");
                
                sql.addAnd("CarReg",  "=", ctx.getParameter("CarReg"));
                sql.addAnd("Session", "=", ctx.getDate("Start"));
                break;
            case "createTableRow":
                sql.addField("Timestamp", ctx.getTimestamp("Start"));
                sql.addField("Miles",     ctx.getParameter("StartMiles"));
                sql.addField("PerCent",   ctx.getParameter("StartPerCent"));
                break;
            case "updateTableRow":
                sql.addField("Timestamp", ctx.getTimestamp("End"));
                sql.addField("Miles",     ctx.getParameter("EndMiles"));
                sql.addField("PerCent",   ctx.getParameter("EndPerCent"));
                break;
            default:
                return;
        }
        executeUpdate(ctx, sql);
        
        if (action.equalsIgnoreCase("updateTableRow") && ctx.getTimestamp("Start") != ctx.getTimestamp("Key~Start")) {
            /*
             * The start time of the session has changed, so update session log to reflect this.
             */
            sql = ctx.getUpdateBuilder("ChargeSessionLog");
            
            sql.addField("Session", ctx.getTimestamp("Start"));
            sql.addAnd("CarReg",  "=", ctx.getParameter("CarReg"));
            sql.addAnd("Session", "=", ctx.getTimestamp("Key~Start"));
            
            executeUpdate(ctx, sql);
            /*
             * Update the timestamp of the first charge session log.
             */
            sql.clear();
            sql.addField("Timestamp", ctx.getTimestamp("Start"));
            sql.addAnd("CarReg",    "=", ctx.getParameter("CarReg"));
            sql.addAnd("Timestamp", "=", ctx.getTimestamp("Key~Start"));
            
            executeUpdate(ctx, sql);
        }
    }
    private void test(Context ctx) throws SQLException, JSONException {
        DatabaseSession.TableDefinition table = ctx.getAppDb().new TableDefinition("Car");
        DatabaseSession.Column          col;
        String                          name;
        JSONObject                      json;
        
        name = Utils.splitToWords("CarSession");
        name = Utils.splitToWords("aCarSession");
        Iterator<DatabaseSession.Column> it = table.iterator();
        
        while (it.hasNext()) {
            col = it.next();
            name = col.getName();
        }
        table.getColumn("Modified").setDisplayName("Modified x");
        name = table.getName();
        json = table.toJson(true);
        json = table.toJson();
    }
    private void validateChangeSession(Context ctx,  String action) throws ParseException, SQLException {
        Date             start   = ctx.getTimestamp("Start");
        Date             end     = ctx.getTimestamp("End");
        Date             keyTime = ctx.getTimestamp("Key~Start");
        int              mileage = ctx.getInt("Mileage", -1);
        EnclosingRecords er       = new EnclosingRecords(ctx, "ChargeSession");
        ResultSet        upper;
        ResultSet        lower;
        
        er.addField("CarReg",  ctx.getParameter("CarReg"), true);
        er.addField("Start",   start,                      false);

        upper = er.getAfter();
        lower = er.getBefore();
        /*
         * Comparing timestamps with those returned by SessionSequence runs into problems with time zones when
         * using Date before after and equal. This seems to because record set returns a java.sql.Timestamp, which
         * does not set a timezone. Using compareTo seems to get round this.
         */
        switch (action) {
            case "deleteTableRow":
                checkExit(upper != null, "Can only delete the most recent session");
                break;                         
            case "createTableRow":
                keyTime = start;                
                // Note: Absense of break is intentional.                
            case "updateTableRow":
                if (keyTime == null) keyTime = start;
                
                if (lower != null) {
                    checkExit(mileage < lower.getInt("Mileage"), "Mileage must be greater or equal to previous");
                }                
                if (upper != null && upper.getTimestamp("Start").compareTo(keyTime) != 0) {
                    checkExit(end != null && end.after(upper.getTimestamp("Start")),  "End time is after the start of the next session");
                    checkExit(mileage > upper.getInt("Mileage"), "Mileage is greater than next session");
                }
                if (action.equals("createTableRow")) {
                    checkExit( 
                            upper != null, 
                            "New session must be the latest");
                    checkExit( 
                            lower != null && lower.getTimestamp("Start").compareTo(start) == 0, 
                            "New session must be after the latest");
                }
                break;
        }
    }    
    @Override
    protected void preChangeTableRow(Context ctx, String tableName, String action) throws SQLException, ParseException {
        if (!tableName.equalsIgnoreCase("chargesession")) return; 
        
        validateChangeSession(ctx, action);
    }
    @Override    
    protected void postChangeTableRow(Context ctx, String tableName, String action) throws SQLException, ParseException {
        if (!tableName.equalsIgnoreCase("chargesession")) return;
        
        log(ctx, action);        
    }
    @Override
    protected void updateTableDefinition(Context ctx, DatabaseSession.TableDefinition table) throws SQLException {
        String name = table.getName();
        
        switch (name) {
            case "Test2":
                table.getColumn("Text21").setSource("ChargerNetwork", "Name");
                break;
            case "Test3":
                table.setParent("Test2");
                break;
            case "ChargerLocation":                
                table.getColumn("Provider").setSource("Company", "Id");
                break;
            case "ChargerUnit":                
                table.getColumn("Location").setSource("ChargerLocation", "Name");
                break;
            default:
                // Ignore all other tables.
        }
    }
    @Override
    /*
     * Added to confirm that override works as expected. Can be removed.
     */
    protected void getTableDefinition(Context ctx) throws SQLException, ParseException, JSONException {
        super.getTableDefinition(ctx);
    }
    @Override
    public String getVersion() {
        return "V1.1 Released 22-May-22";    
    }
    @Override
    public void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {
        databases.setApplication(
                super.config.getProperty("btdatabase"),
                super.config.getProperty("btuser"),
                super.config.getProperty("btpassword"));
    }
    @Override
    public void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        String schema  = ctx.getAppDb().getProtocol().equals("sqlserver")? "dbo" : "BloodPressure";
        String endName = ctx.getAppDb().delimitName("End");
        
        switch (action) {
            case "chargesessions":
                {
                    JSONObject       data     = new JSONObject();
                    ResultSet        rs;
                    SQLSelectBuilder sql      = ctx.getSelectBuilder("ChargeSession");                   
                    Object           rateCast = sql.setCast("DECIMAL", 8, 2);
                    
                    sql.setProtocol(ctx.getAppDb().getProtocol());
                    sql.setMaxRows(config.getIntProperty("banktransactionrows", 100));
                    sql.addField("CarReg");
                    sql.addField("Start");
                    sql.addField("End");  
                    sql.addField("Weekday", sql.setExpressionSource(schema + ".WeekDayName(Start)"));
                    sql.addField("EstDuration", "EstDuration");
                    sql.addField("Charger");
                    sql.addField("Unit");
                    sql.addField("Mileage");
                    sql.addField("Rate",     sql.setExpressionSource(schema + ".GetTimeDiffPerUnit(Start, " + endName + ", EndPerCent - StartPerCent) / 60 "), rateCast);
                    sql.addField("Duration", sql.setExpressionSource(schema + ".GetTimeDiffPerUnit(Start, " + endName + ", EndPerCent - StartPerCent) / 60 * (100 - EndPercent)"), rateCast);       
                    sql.addField("StartMiles", "StartMiles");
                    sql.addField("StartPerCent",     "StartPerCent");
                    sql.addField("EndMiles",   "EndMiles");
                    sql.addField("EndPerCent",       "EndPerCent");
                    sql.addField("Charge");
                    sql.addField("Cost");
                    sql.addField("Comment");
                    sql.addAnd(ctx.getParameter("filter"));
                    sql.addOrderByField("CarReg", true);
                    sql.addOrderByField("Start", true);
                    rs = executeQuery(ctx, sql);
                    data.add("ChargeSessions", rs);
                    data.append(ctx.getReplyBuffer(), "");
                    break;
                }
            case "chargers":
                {
                    JSONObject       data   = new JSONObject();
                    ResultSet        rs;
                    SQLSelectBuilder sql    =  ctx.getSelectBuilder("Chargers");
                    sql.setProtocol(ctx.getAppDb().getProtocol());
                    sql.setMaxRows(config.getIntProperty("banktransactionrows", 100));
                    sql.addField("Name");
                    sql.addField("Network");
                    sql.addField("Unit");
                    sql.addField("Active");
                    sql.addField("Rate");
                    sql.addField("Tariff");
                    sql.addField("Location");
                    sql.addField("Comment");
                    rs = executeQuery(ctx, sql);
                    data.add("ChargeSessions", rs);
                    data.append(ctx.getReplyBuffer(), "");
                    break;
                }
            case "sessionlog": {
                JSONObject      data = new JSONObject();
                ResultSet         rs;
                SQLSelectBuilder sql = ctx.getSelectBuilder("SessionLog");
                sql.setProtocol(ctx.getAppDb().getProtocol());
                sql.setMaxRows(config.getIntProperty("banktransactionrows", 100));
                sql.addField("*");
                sql.addAnd(ctx.getParameter("filter"));
                sql.addOrderByField("Timestamp", true);
                rs = executeQuery(ctx, sql);
                data.add("SessionLog", rs);
                data.append(ctx.getReplyBuffer(), "");
                break;
            }
            default:
                invalidAction();
                break;
        }
    }
}
