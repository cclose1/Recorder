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
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;
/**
 *
 * @author chris
 */

public class CarUsage extends ApplicationServer {
    private class ChargeParameters {  
        private String location;
        private String unit;
        private String reg;
        private float  capacity = -1;
        private float  rate     = -1;
    
        public ChargeParameters(Context ctx, String reg, String location, String unit) throws SQLException, ParseException {
            SQLSelectBuilder sql = ctx.getSelectBuilder("Car");
            ResultSet        rs;
            
            this.location = location;
            this.unit     = unit;
            this.reg      = reg;
            
            sql.addField("Capacity");
            sql.addAnd("Registration", "=", reg);
            rs = executeQuery(ctx, sql);
            
            if (rs.next()) capacity = rs.getFloat("Capacity");
            
            sql.clear();
            
            sql.setTable("ChargerLocation");
            sql.addAnd("Name", "=", location);
            sql.addField("Rate");
            rs = executeQuery(ctx, sql);
            
            if (rs.next()) rate = rs.getFloat("Rate");
            
            if (!unit.equals("")) {
                sql.clear();
                sql.setTable("ChargerUnit");
                sql.addField("Rate");
                sql.addAnd("Location", "=", location);
                sql.addAnd("Name",     "=", unit);
                sql.addAndClause("Rate IS NOT NULL");
            }
            if (rs.next()) capacity = rs.getFloat("Rate");
        }
        public ChargeParameters(Context ctx) throws SQLException, ParseException {
            this(ctx, ctx.getParameter("CarReg"), ctx.getParameter("Charger"), ctx.getParameter("Unit"));
        }

        public float getCapacity() {
            return capacity;
        }
        public float getRate() {
            return rate;
        }
        public float getKwh(Date from, Date to) {
            return rate * (to.getTime() - from.getTime()) / 3600000;
        }
    }
    public class OffPeakUsage {
        private Date    opStart        = null;   // Offpeak start
        private Date    opEnd          = null;
        private Date    ssStart        = null;   // Session start
        private Date    ssEnd          = null;   // session end        
        private Date    sopStart       = null;   // Session start that is within offpeak        
        private Date    sopEnd         = null;   // Session end that is within offpeak
        private String  provider       = null;
        private String  meter          = null;
        private String  action         = null;
        private Date    mtStart        = null;
        private double  ssKwh           = -1;
        private double  opKwhFromCost   = -1;
        private double  opKwhFromRatio  = -1;
        private double  opKwhFromApprox = -1;
        private double  opKwh           = -1;
        private String  opKwhDerivation = "";
        private double  cost            = -1;
        private double  pkRate          = -1;
        private double  opRate          = -1;
        private double  credit          = -1;
        private boolean supportsCredit  = false;
        private Context ctx;
        private boolean closed          = false;
      
        private void setOpKwh(double kwh, String derivation) {
            opKwh           = Utils.round(kwh, 2);
            opKwhDerivation = derivation;
        }
        /*
         * Sets the appropriate variable for the different options for calculating the offpeak kwh.
         */
        private void setOpKwhOptions() throws SQLException, ParseException {
            if (cost > 0 && pkRate > 0) {
                /*
                 * We can break down the session kwh into the part that takes in the off peak and the
                 * part that takes place in the peak. The following equations apply
                 *
                 *    pkRate * pkKwh + opRate * opKwh = 100 * cost
                 *    pkKwy + opKwh = ssKwh
                 *
                 * Solving them for opKwh gives the following.
                 */
                opKwhFromCost = Utils.round((100 * cost  - pkRate * ssKwh) / (opRate - pkRate), 2);
                
                if (!action.equalsIgnoreCase("openTableRow")) {
                    if (opKwhFromCost < 0)     errorExit("Cost " + cost + " produces a negative off peak Kwh value");
                    if (opKwhFromCost > ssKwh) errorExit("Cost " + cost + " produces a negative peak Kwh value");
                }
            }
            opKwhFromRatio = ssKwh * (sopEnd.getTime() - sopStart.getTime()) / (ssEnd.getTime() - ssStart.getTime());
            /*
             * Session overlaps off peak and end % > 95. 
             */
            ChargeParameters cp = new ChargeParameters(ctx);
            /*
             * Get opKwh assuming charge rate is constant.
             */
            double kwh = ssKwh;
            /*
             * This assumes that if the session start is before off peak start, then the charge rate is
             * uniform, so subtract peak kwh before offpeak start from session kwh.
             *
             * Note: In this case sopStart will be opStart.
             */
            if (ssStart.before(opStart)) {
                kwh -= cp.getKwh(ssStart, opStart);
            }
            opKwhFromApprox = cp.getKwh(sopStart, sopEnd);
            /*
             * If opKwh exceeds the remaining kwh, then the charge rate is not uniform, so assume the extra charge
             * after off peak minima;
             */
            if (opKwh > opKwhFromApprox) {
                kwh = opKwhFromApprox;
            }
            opKwhFromApprox = kwh;
        }
        public Date getOffPeakStart() {
            return opStart;
        }
        public Date getOffPeakEnd() {
            return opEnd;
        }
        public Date getSessionStart() {
            return ssStart;
        }
        public Date getSessionEnd() {
            return ssEnd;
        }
        public double getOffPeakKwh() {
            return opKwh;
        }
        public double getSessionKwh() {
            return ssKwh;
        }
        public boolean supportsCredit() {
            return supportsCredit;
        }
        public void updateCredit(boolean close) throws SQLException {
            SQLUpdateBuilder sql  = ctx.getUpdateBuilder("Company");
        
            if (!supportsCredit() || cost < 0) return;
            
            sql.addIncrementField("Credit", close? -cost : cost);
            sql.addAnd("Id", "=", provider);
            executeUpdate(ctx, sql);
        }
        private void logUpdate(boolean close) throws SQLException {  
            SQLBuilder sql = close? ctx.getInsertBuilder("ChargeSessionStats") : ctx.getDeleteBuilder("ChargeSessionStats");
            
            if (close) {
                sql.addField("SessionStart",    ssStart);
                sql.addField("Kwh",             ssKwh);
                sql.addField("OpKwh",           opKwh);
                sql.addField("OpDerivation",    opKwhDerivation);
                sql.addField("OpKwhFromCost",   opKwhFromCost);
                sql.addField("OpKwhFromRatio",  opKwhFromRatio);
                sql.addField("OpKwhFromApprox", opKwhFromApprox);
                sql.addField("PkRate",          pkRate);
                sql.addField("OpRate",          opRate);
                sql.addField("Cost",            cost);
                
                if (mtStart != null) sql.addField("MeterStart",   mtStart);
            } else {
                sql.addAnd("SessionStart", "=", ssStart);
            }
            executeUpdate(ctx, sql);
        }
        public void updateOffPeak(boolean close) throws SQLException {
            SQLBuilder sql  = close? ctx.getInsertBuilder("MeterOffPeak") : ctx.getDeleteBuilder("MeterOffPeak") ;
            
            logUpdate(close);
            
            if (opKwh == -1) return;
            
            if (close) {
                sql.addField("Meter",     meter);
                sql.addField("Timestamp", sopStart);
                sql.addField("Kwh",       opKwh);            
                sql.addField("Minutes",   DateFormatter.dateDiff(sopStart, sopEnd, DateFormatter.TimeUnits.Minutes));
            } else {
                sql.addAnd("Meter",     "=", meter);
                sql.addAnd("Timestamp", "=", sopStart);
            }
            executeUpdate(ctx, sql);
        }
        public void close(boolean close) throws SQLException {
            SQLUpdateBuilder sql  = ctx.getUpdateBuilder("ChargeSession");
            
            sql.addField("Closed", close? "Y" : "N");
            sql.addAnd("CarReg", "=", ctx.getParameter("CarReg"));
            sql.addAnd("Start",  "=", ssStart);
            executeUpdate(ctx, sql);
        }
        public OffPeakUsage(Context ctx) throws SQLException, ParseException {            
            SQLSelectBuilder sql     = ctx.getSelectBuilder("ChargerLocation"); 
            EnclosingRecords er      = new EnclosingRecords(ctx, "MeterReading");
            String           start[] = ctx.getParameter("Start").split(" ");
            String           opstime;
            String           opetime;
            String           chDuration;
            ResultSet        rs;
            
            this.ctx     = ctx;
            this.ssStart = ctx.getTimestamp("Start");
            this.action  = ctx.getParameter("action");
            
            sql.addField("Provider");
            sql.addAnd("Name", "=", ctx.getParameter("Charger"));
            
            rs = executeQuery(ctx, sql);
            
            if (!rs.next()) return;
            
            provider = rs.getString("Provider");
            
            if (provider == null) return;
            
            if (!provider.equals("Home")) {
                /*
                 * Company providing get credit if any.
                 */
                sql = ctx.getSelectBuilder("Company");
                sql.addField("*");
                sql.addAnd("Id", "=", provider);
                rs = executeQuery(ctx, sql);
                rs.next();
                
                credit         = rs.getDouble("Credit");
                supportsCredit = !rs.wasNull();
                return;
            }            
            sql = ctx.getSelectBuilder("Tariff");
            
            chDuration = ctx.getParameter("ChargeDuration");
            ssKwh      = ctx.getDouble("Charge", -1);            
            cost       = ctx.getDouble("Cost", -1);
            
            if (chDuration.length() == 0)
                ssEnd = ctx.getTimestamp("End");
            else {
                ssEnd = new Date(ssStart.getTime());
                ctx.incrementDate(ssEnd, chDuration);
            }
            sql.addField("*");
            sql.addAndStart(ssStart);
            sql.addAnd("Type", "=", "Electric");
            sql.addAnd("Code", "NOT LIKE", "%Test%"); // Not a good way of doing this.
            rs = executeQuery(ctx, sql);
           
            if (!rs.next()) errorExit("Tariff not found for " + start[0] + ' ' + start[1]);
            
            pkRate = rs.getDouble("UnitRate");
            opRate = rs.getDouble("OffPeakRate");
            
            if (opRate <= 0) return;  // Tariff does not have off peak
         
            opstime = rs.getString("OffPeakStart");
            opetime = rs.getString("OffPeakEnd");
            
            opStart = ctx.toDate(start[0], opstime);
            opEnd   = ctx.toDate(start[0], opetime);
            
        if (opEnd.before(ssStart)) {
                /*
                 * Off peak starts in the day following the session.
                 */
                ctx.incrementDate(opStart, "24");
                ctx.incrementDate(opEnd,   "24");
            }
            if (ctx.toSeconds(opetime) < ctx.toSeconds(opstime)) 
                /*
                 * The end time is in the following day. Add 1 day to session day .
                 */
                ctx.incrementDate(opEnd, "24");
            
            if (ssEnd.before(opStart) || ssStart.after(opEnd)) return; // Session does not overlap off peak.
            
            sopStart = ssStart.before(opStart)? opStart : ssStart;
            sopEnd   = ssEnd.after(opEnd)? opEnd : ssEnd;
            setOpKwhOptions();
            /*
             * Calculate the Kwh for the overlapping part of the session. This is done to get the offpeak usage for
             * charging so the offpeak usage for billing can be estimated. This is not directly recorded by
             * the smart meter. The most part of the offpeak usage will be due to charging the car.
             */
            if (!ssStart.before(opStart) && !ssEnd.after(opEnd) || ctx.getDouble("EndPerCent", 0) < 96) 
            {
                /*
                 * This will be the majority of cases, as most of the charging takes place in the off peak.
                 */
                setOpKwh(opKwhFromRatio, "FromRatio");
            }
            else if (opKwhFromCost > -1 )
                setOpKwh(opKwhFromCost, "FromCost");
            else     
                setOpKwh(opKwhFromApprox, "FromApprox");
            
            meter = getMeter(ctx, ssStart, "Electric");
            er.addField("Meter",     meter,    true);
            er.addField("Timestamp", sopStart, false);
            
            if (er.getBefore() != null) mtStart = ctx.getDateTime(er.getBefore(), "Timestamp");
        }
    }
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
        EnclosingRecords er      = new EnclosingRecords(ctx, "ChargeSession");
        ResultSet        upper;
        ResultSet        lower;
        
        er.addField("CarReg",  ctx.getParameter("CarReg"), true);
        er.addField("Start",   start,                      false);

        upper = er.getAfter();
        lower = er.getBefore(!action.equals("updateTableRow"));
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
            case "test2":
                table.getColumn("Text21").setSource("ChargerNetwork", "Name");
                break;
            case "test3":
                table.setParent("Test2");
                break;
            case "chargerlocation":                
                table.getColumn("Provider").setSource("Company", "Id");
                break;
            case "chargerunit":                
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
    public void completeAction(Context ctx, boolean start) throws SQLException, ParseException {        
        if (ctx.getParameter("action").equals("updateTableRow") && !start) {
            OffPeakUsage upc = new OffPeakUsage(ctx);
            
            if (ctx.getParameter("close").equals("true")) {
                upc.updateCredit(true);
                upc.updateOffPeak(true);
                upc.close(true);
            }
        } else if (ctx.getParameter("action").equals("openTableRow")) {
            OffPeakUsage upc = new OffPeakUsage(ctx);
            
            upc.updateCredit(false);
            upc.updateOffPeak(false);
            upc.close(false);
        }
    }
    @Override
    public void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        String schema  = ctx.getAppDb().getProtocol().equals("sqlserver")? "dbo" : "BloodPressure";
        String endName = ctx.getAppDb().delimitName("End");
        
        switch (action) {
            case "getchargeparameters": {
                    JSONObject       data = new JSONObject();
                    ChargeParameters cps  = new ChargeParameters(
                            ctx, 
                            ctx.getParameter("CarReg"),
                            ctx.getParameter("Charger"),
                            ctx.getParameter("Unit"));
                    data.add("Capacity", cps.getCapacity());
                    data.add("Rate",     cps.getRate());
                    data.append(ctx.getReplyBuffer(), "");
                break;
            }
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
                    sql.addField("EstDuration");
                    sql.addField("MaxDuration");
                    sql.addField("Charger");
                    sql.addField("Unit");
                    sql.addField("Mileage");
                    sql.addField("Rate",     sql.setExpressionSource(schema + ".GetTimeDiffPerUnit(Start, " + endName + ", EndPerCent - StartPerCent) / 60 "), rateCast);
                    sql.addField("Duration", sql.setExpressionSource(schema + ".GetTimeDiffPerUnit(Start, " + endName + ", EndPerCent - StartPerCent) / 60 * (100 - EndPercent)"), rateCast);       
                    sql.addField("StartMiles");
                    sql.addField("EndMiles");
                    sql.addField("StartPerCent");
                    sql.addField("EndPerCent");
                    sql.addField("ChargeDuration");
                    sql.addField("Charge");
                    sql.addField("Cost");
                    sql.addField("Closed");
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
                    sql.addField("Location");
                    sql.addField("Comment");
                    rs = executeQuery(ctx, sql);
                    data.add("ChargeSessions", rs);
                    data.append(ctx.getReplyBuffer(), "");
                    break;
                }
            case "sessionlog": {
                JSONObject       data = new JSONObject();
                ResultSet        rs;
                SQLSelectBuilder sql  = ctx.getSelectBuilder("SessionLog");
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
            case "openTableRow":
            break;
            default:
                invalidAction();
                break;
        }
    }
}
