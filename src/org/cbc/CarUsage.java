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
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.utils.system.DateFormatter;

/**
 *
 * @author chris
 */
public class CarUsage extends ApplicationServer {    
    private TableUpdater     session        = new TableUpdater("ChargeSession");
    private TableReader      sessions       = new TableReader();
    private SQLSelectBuilder sqlCarSessions = new SQLSelectBuilder("ChargeSession");

    private class SessionSequence {
        public Date start   = null;
        public Date end     = null;
        public int  mileage = -1;
        
        public SessionSequence(Context ctx, String carReg, Date start, boolean previous) throws SQLException {
            SQLSelectBuilder sql = new SQLSelectBuilder("ChargeSession");
            ResultSet        rs;
            
            sql.setProtocol(ctx.getAppDb().getProtocol());
            sql.setMaxRows(1);
            sql.addField("CarReg");
            sql.addField("Start");
            sql.addField("Mileage");
            sql.addField("End");
            sql.addAnd("CarReg", "=", carReg);
            sql.addAnd("Start", previous? "<=" : ">", start);
            sql.addOrderByField("Start", previous);
            rs = executeQuery(ctx, sql);
            
            if (!rs.first()) return;
            
            this.start = rs.getTimestamp("Start");
            end        = rs.getTimestamp("End");
            mileage    = rs.getInt("Mileage");
        }
    }
    @Override
    public String getVersion() {
        return "V1.1 Released 22-May-22";    
    }
    public void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {
        databases.setApplication(
                super.config.getProperty("btdatabase"),
                super.config.getProperty("btuser"),
                super.config.getProperty("btpassword"));
    }
    public void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        session.setContext(ctx);
        Date test = DateFormatter.parseDate("2022-09-03 12:08:10");
        SessionSequence next = new SessionSequence(ctx, ctx.getParameter("carreg"), test, false);
        SessionSequence prev = new SessionSequence(ctx, ctx.getParameter("carreg"), test, true);
        switch (action) {
            case "createsession":                
            case "updatesession":               
            case "deletesession":          
                sqlCarSessions.clearWhere();
                sqlCarSessions.addAnd("CarReg", "=", ctx.getParameter("carreg"));                
                sessions.open(ctx, sqlCarSessions);
                if (action.equals("createsession")) {
                    if (sessions.rowExists()) {
                        if (ctx.getInt("mileage", -1) < sessions.getInt("Mileage")) {
                            ctx.getReplyBuffer().append("Mileage must be greater or equal to previous");
                            ctx.setStatus(200);
                            return;
                        }
                        if (ctx.getTimestamp("sdate", "stime").before(sessions.getDate("Start"))) {
                            ctx.getReplyBuffer().append("Start date must not be before previous");
                            ctx.setStatus(200);
                            return;
                        }
                    }
                    session.createRow();
                }
                else if (action.equals("updatesession"))
                    session.updateRow();
                else {
                    if (sessions.rowExists() && ctx.getTimestamp("sdate", "stime").before(sessions.getDate("Start"))) {
                        ctx.getReplyBuffer().append("Can only delete the most recent session");
                        ctx.setStatus(200);
                        return;
                    }
                    session.deleteRow();
                }
                break;
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
                    
                    if (sql.getProtocol().equalsIgnoreCase("sqlserver")) {
                        sql.addField("Weekday",   sql.setExpressionSource("SUBSTRING(DATENAME(WEEKDAY, Start), 1, 3)"));
                    } else {
                        sql.addField("Weekday",   sql.setExpressionSource("SubStr(DayName(Start), 1, 3)"));
                    } 
                    sql.addField("Start Duration", "EstDuration");
                    sql.addField("Charger");
                    sql.addField("Unit");
                    sql.addField("Mileage");
                    
                    if (sql.getProtocol().equalsIgnoreCase("sqlserver")) {
                        sql.addField("Rate",     sql.setExpressionSource("DATEDIFF(mi, Start, [End]) / (EndPerCent - StartPerCent)"), rateCast);
                        sql.addField("Duration", sql.setExpressionSource("DATEDIFF(mi, Start, [End]) / (EndPerCent - StartPerCent) * (100 - EndPercent)"), rateCast);
                    } else {
                        sql.addField("Rate",     sql.setExpressionSource("TIMESTAMPDIFF(MINUTE, Start, End) / (EndPerCent - StartPerCent)"), rateCast);
                        sql.addField("Duration", sql.setExpressionSource("TIMESTAMPDIFF(MINUTE, Start, End) / (EndPerCent - StartPerCent) * (100 - EndPercent)"), rateCast);
                    }       
                    sql.addField("Start Miles", "StartMiles");
                    sql.addField("Start %",     "StartPerCent");
                    sql.addField("End Miles",   "EndMiles");
                    sql.addField("End %",       "EndPerCent");
                    sql.addField("Charge");
                    sql.addField("Cost");
                    sql.addField("Comment");
                    session.addFilter(sql);
                    session.addOrderBy(sql, true);
                    rs = executeQuery(ctx, sql);
                    data.add("ChargeSessions", rs);
                    data.append(ctx.getReplyBuffer(), "");
                    ctx.setStatus(200);
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
    //                session.addFilter(sql);
    //                session.addOrderBy(sql, true);
                    rs = executeQuery(ctx, sql);
                    data.add("ChargeSessions", rs);
                    data.append(ctx.getReplyBuffer(), "");
                    ctx.setStatus(200);
                    break;
                }
            case "getList":
                getList(ctx);
                break;
            default:
                ctx.dumpRequest("Action " + action + " is invalid");
                ctx.getReplyBuffer().append("Action " + action + " is invalid"); 
                break;
        }
    }
    public void init(ServletConfig config) throws ServletException{
        super.init(config);
                
        session.addField("CarReg",       true,  "carreg");
        session.addField("Start",        true,  "sdate",     "stime");
        session.addField("Charger",      false, "chargesource");
        session.addField("Unit",         false, "chargeunit");
        session.addField("Comment",      false, "sessioncomment");
        session.addField("Mileage",      false, "mileage",     true);
        session.addField("EstDuration",  false, "estduration", true);
        session.addField("StartPercent", false, "schargepc",   true);
        session.addField("StartMiles",   false, "smiles",      true);
        session.addField("End",          false, "edate",       "etime");
        session.addField("EndPercent",   false, "echargepc",   true);
        session.addField("EndMiles",     false, "emiles",      true);
        session.addField("Charge",       false, "charge",      true);
        session.addField("Cost",         false, "cost",        true);
        
        sqlCarSessions.addField("*");
        sqlCarSessions.addOrderByField("Start", true);
    }
}
