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
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.utils.data.DatabaseSession;
/**
 *
 * @author chris
 */
public class CarUsage extends ApplicationServer {
    enum SeqCompare {NEXT, PREV, PREVEQ}
                
    private final TableUpdater session = new TableUpdater("ChargeSession");
    /*
     * Used to find the ChargeSession nearest to a particular time.
     */
    private class SessionSequence {
        public Date start   = null;
        public Date end     = null;
        public int  mileage = -1;
        /*
         * For a particular CarReg returns the details of the record nearest to start according to compare.
         *
         *  Compare  Match Record
         *     NEXT  One with the earlist timestamp after start.
         *     PREV  One with the latest timestamp that is before start
         *   PREVEQ  One with the latest timestamp that is before or equal to start.
         */                
        public SessionSequence(Context ctx, String carReg, Date start, SeqCompare compare) throws SQLException {
            SQLSelectBuilder sql = new SQLSelectBuilder("ChargeSession", ctx.getAppDb().getProtocol());
            ResultSet        rs;
            boolean          desc = true;
            String           test = "";
            
            switch (compare) {
                case NEXT:
                    test = ">";
                    desc = false;
                    break;
                case PREV:
                    test = "<";
                    break;
                case PREVEQ:
                    test = "<=";
                    break;
            }
            if (start == null) return;
            
            sql.setProtocol(ctx.getAppDb().getProtocol());
            sql.setMaxRows(1);
            sql.addField("CarReg");
            sql.addField("Start");
            sql.addField("Mileage");
            sql.addField("End");
            sql.addAnd("CarReg", "=", carReg);
            sql.addAnd("Start", test, start);
            sql.addOrderByField("Start", desc);
            rs = executeQuery(ctx, sql);
            
            if (!rs.first()) return;
            
            this.start = rs.getTimestamp("Start");
            end        = rs.getTimestamp("End");
            mileage    = rs.getInt("Mileage");
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
    private void changeSession(Context ctx,  String action) throws ParseException, SQLException {
        Date            start   = ctx.getTimestamp("sdatetime");
        Date            end     = ctx.getTimestamp("edatetime");
        Date            keyTime = ctx.getTimestamp("keytimestamp");
        int             mileage = ctx.getInt("mileage", -1);
        SeqCompare      compare = SeqCompare.PREV;
        SessionSequence next    = new SessionSequence(ctx, ctx.getParameter("carreg"), start, SeqCompare.NEXT);
        /*
         * Comparing timestamps with those returned by SessionSequence runs into problems with time zones when
         * using Date before after and equal. This seems to because record set returns a java.sql.Timestamp, which
         * does not set a timezone. Using compareTo seems to get round this.
         */
        switch (action) {
            case "deletesession":
                checkExit(ctx, next.start != null, "Can only delete the most recent session");                
                session.deleteRow();  
                break;                         
            case "createsession":
                compare = SeqCompare.PREVEQ;
                keyTime = start;
                
                // Note: Absense of break is intentional.
                
            case "updatesession":
                SessionSequence prev = new SessionSequence(ctx, ctx.getParameter("carreg"), start, compare);
                
                if (prev.start != null) {
                    checkExit(ctx, mileage < prev.mileage, "Mileage must be greater or equal to previous");
                }
                
                if (next.start != null && next.start.compareTo(keyTime) != 0) {
                    checkExit(ctx, end.after(next.start),  "End time is after the start of the next session");
                    checkExit(ctx, mileage > next.mileage, "Mileage is greater than next session");
                }
                if (action.equals("createsession")) {
                    checkExit(
                            ctx, 
                            next.start != null, 
                            "New session must be the latest");
                    checkExit(
                            ctx, 
                            prev.start != null && prev.start.compareTo(start) == 0, 
                            "New session must be after the latest");
                    session.createRow();
                }
                else
                    session.updateRow(keyTime.equals(start)? "" : "Start-keytimestamp");
                break;
        }
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
                table.getColumn("Network").setSource("ChargerNetwork", "Name");
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
        session.setContext(ctx);
        
        switch (action) {
            case "createsession":                
            case "updatesession":               
            case "deletesession":
                changeSession(ctx, action);
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
        session.addField("Start",        true,  "sdatetime",   false, true);
        session.addField("Charger",      false, "chargesource");
        session.addField("Unit",         false, "chargeunit");
        session.addField("Comment",      false, "sessioncomment");
        session.addField("Mileage",      false, "mileage",     true);
        session.addField("EstDuration",  false, "estduration", true);
        session.addField("StartPercent", false, "schargepc",   true);
        session.addField("StartMiles",   false, "smiles",      true);
        session.addField("End",          false, "edatetime",   false, true);
        session.addField("EndPercent",   false, "echargepc",   true);
        session.addField("EndMiles",     false, "emiles",      true);
        session.addField("Charge",       false, "charge",      true);
        session.addField("Cost",         false, "cost",        true);        
    }
}
