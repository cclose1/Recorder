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
import java.util.TimeZone;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import org.cbc.json.JSONException;
import org.cbc.json.JSONTable;
import org.cbc.sql.SQLBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.sql.SQLValue;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.data.EnhancedResultSet;
import org.cbc.utils.system.DateFormatter;
/**
 *
 * @author chris
 */

public class CarUsage extends ApplicationServer {
    public  static enum ValueAgg{MIN, AVG, MAX, STD};
       
    private class ChargeEstimates {
        private String    charger = "";
        private String    unit    = "";
        private String    reg     = "";
        private Context   ctx     = null;
        private JSONTable params  = null;
        
        private class GainParams {
            private Context   ctx;
            private ResultSet rs; 
            private float     gain         = 0;
            private float     minCharge    = 0;
            private float     avgCharge    = 0;
            private float     maxCharge    = 0;
            private float     stdCharge    = 0;
            private float     minDuration  = 0;
            private float     avgDuration  = 0;
            private float     stdDuration  = 0;
            private float     maxDuration  = 0;
            private String    derivation   = "Linear";
            private boolean   estimated    = false;
            private int       sessions     = 0;
            
            public void loadResultSet (String source, ResultSet rs) throws SQLException, JSONException, ParseException {
                EnhancedResultSet ers = new EnhancedResultSet(rs);
                params.addRow(ers);
                params.set("Source", source);
                
                minCharge    = rs.getFloat("MinCharge");
                avgCharge    = rs.getFloat("AvgCharge");
                maxCharge    = rs.getFloat("MaxCharge");
                stdCharge    = rs.getFloat("StdCharge");
                minDuration  = rs.getFloat("MinDuration");
                avgDuration  = rs.getFloat("AvgDuration");
                maxDuration  = rs.getFloat("MaxDuration");
                stdDuration  = rs.getFloat("StdDuration");
                sessions     = rs.getInt("Sessions");
            }
            public GainParams(Context ctx) {
                this.ctx = ctx;
            }
            
            public void loadGainParams(SQLSelectBuilder sql, String source) throws SQLException, JSONException, ParseException {
                sql.addField("*");
                sql.addAnd("CarReg",  "=", reg);
                sql.addAnd("Charger", "=", charger);
                rs = executeQuery(ctx, sql);
                
                if (rs.next()) {
                    loadResultSet(source, rs);
                } else {
                    params.addRow();
                    avgCharge    = capacity * gain / 100;
                    avgDuration  = gain / 13;
                    derivation   = "LinearApprox";
                    estimated    = true;
                    params.set("AvgCharge",   avgCharge);
                    params.set("AvgDuration", avgDuration);
                    params.set("Source",      source);
                    params.set("Gain",        gain);
                    params.set("Sessions",    0);
                }
            }            
            public void loadGainParams(String source, float gain) throws SQLException, JSONException, ParseException {
                SQLSelectBuilder sql = ctx.getSelectBuilder("ChargeParamsLinear");
                this.gain = gain;
                sql.addAnd("Gain", "=", "" + gain);
                
                loadGainParams(sql, source);
            }
            
            public void loadGainParams(String source, float startPC, float endPC, String comp) throws SQLException, JSONException, ParseException {
                SQLSelectBuilder sql = ctx.getSelectBuilder("ChargeParamsNonLinear");
                
                sql.addAnd("EndPerCent",    "=",  new SQLValue(endPC));
                sql.addAnd("StartPerCent",  comp, new SQLValue(startPC));
                sql.addOrderByField("Sessions", true);
                gain = endPC - startPC;
                loadGainParams(sql, source);
                derivation = "NonLinear";
                
                if (estimated) {
                    params.set("StartPerCent", startPC);
                    params.set("EndPerCent",   endPC);
                }
            }
            
            public void loadGainParams(String source, float startPC, float endPC) throws SQLException, JSONException, ParseException {
                loadGainParams(source, endPC - startPC);
                params.set("StartPerCent", startPC);
                params.set("EndPerCent",   endPC);
            }
            public int getInt(String name) throws SQLException {
                return rs.getInt(name);
            }
            public float getFloat(String name) throws SQLException {
                return rs.getFloat(name);
            }
        }
        private float capacity     = -1;
        private float rate         = -1;
        private float targPerCent  = 0;
        private float startPerCent = 0;
        
        private GainParams gainParams;
       
        private void loadEstimateParams(Context ctx) throws SQLException, ParseException, JSONException { 
            GainParams gainNonLinIni;
            GainParams gainNonLin;
            
            gainParams    = new GainParams(ctx);  
            gainNonLinIni = new GainParams(ctx);           
            gainNonLin    = new GainParams(ctx);
                        
            gainNonLinIni.loadGainParams("NL", startPerCent, targPerCent, "=");
                        
            if (startPerCent <= 90) {
                gainParams.loadGainParams("LN90", startPerCent, targPerCent > 90? 90 : targPerCent);
                
                if (targPerCent <= 90) return;
            }             
            gainNonLin.loadGainParams("NLToTrg", startPerCent, targPerCent, startPerCent > 90? "=" : "<=");
            
            if (!gainNonLin.estimated) {                
                if (startPerCent <= 90) {
                    GainParams adj = new GainParams(ctx);
                    /*
                     * Need to adjust the estKwh and estDuration of gainParams
                     */
                    adj.loadGainParams("Adj", gainNonLin.getInt("StartPerCent"), 90);
                    
                    gainParams.minCharge    = 0;
                    gainParams.avgCharge   += gainNonLin.getFloat("AvgCharge")   - adj.avgCharge;
                    gainParams.maxCharge    = 0;
                    gainParams.stdCharge    = 0;
                    gainParams.minDuration  = 0;
                    gainParams.avgDuration += gainNonLin.getFloat("AvgDuration") - adj.avgDuration;
                    gainParams.maxDuration  = 0;
                    gainParams.stdDuration  = 0;
                    gainParams.derivation   = "LinearPlus";
                } else {
                    gainParams.derivation = "NonLinear";
                }
            } else {
                /*
                 * This will be the case if there is no match on targPerCent. Could attempt tp approximate
                 * from existing data, but probably worth the effort
                 */
                gainParams.derivation = "Incomplete";
            }
            if (gainParams.derivation.equals("Incomplete") && !gainNonLin.estimated)
                gainParams = gainNonLin;
        }
        private void loadCarParams(Context ctx) throws SQLException {
            SQLSelectBuilder sql = ctx.getSelectBuilder("Car");
            ResultSet        rs;            
            
            sql.addField("Capacity");
            sql.addAnd("Registration", "=", reg);
            rs = executeQuery(ctx, sql);
            
            if (rs.next()) capacity = rs.getFloat("Capacity");
            
            sql.clear();
            
            sql.setTable("ChargerLocation");
            sql.addAnd("Name", "=", this.charger);
            sql.addField("Rate");
            rs = executeQuery(ctx, sql);
            
            if (rs.next()) rate = rs.getFloat("Rate");
            
            if (!unit.equals("")) {
                sql.clear();
                sql.setTable("ChargerUnit");
                sql.addField("Rate");
                sql.addAnd("Location", "=", this.charger);
                sql.addAnd("Name",     "=", unit);
                sql.addAndClause("Rate IS NOT NULL");
            }
            if (rs.next()) rate = rs.getFloat("Rate");       
        }
        public ChargeEstimates(Context context) throws SQLException, ParseException, JSONException {
            ctx          = context;
            charger      = ctx.getParameter("Charger");
            reg          = ctx.getParameter("CarReg");
            unit         = ctx.getParameter("Unit");
            targPerCent  = ctx.getFloat("TargetPerCent", 100);
            startPerCent = ctx.getFloat("StartPerCent", 0);
            params       = new JSONTable("Params");
            
            loadCarParams(ctx);
            params.addColumn("Source",       JSONTable.ColumnType.Text,    15, 0);
            params.addColumn("StartPerCent", JSONTable.ColumnType.Decimal, 6, 2);
            params.addColumn("EndPerCent",   JSONTable.ColumnType.Decimal, 6, 2);
            params.addColumn("Gain",         JSONTable.ColumnType.Decimal, 6, 2);
            params.addColumn("Sessions",     JSONTable.ColumnType.Int,     4, 0);
            params.addColumn("MinCharge",    JSONTable.ColumnType.Decimal, 6, 2);
            params.addColumn("AvgCharge",    JSONTable.ColumnType.Decimal, 6, 2);
            params.addColumn("MaxCharge",    JSONTable.ColumnType.Decimal, 6, 2);
            params.addColumn("StdCharge",    JSONTable.ColumnType.Decimal, 6, 2);
            params.addColumn("MinDuration",  JSONTable.ColumnType.Time,    6, 2);
            params.addColumn("AvgDuration",  JSONTable.ColumnType.Time,    6, 3);
            params.addColumn("MaxDuration",  JSONTable.ColumnType.Time,    6, 3);
            params.addColumn("StdDuration",  JSONTable.ColumnType.Time,    6, 3);
            loadEstimateParams(ctx);
        }
        public float getKwh(Date from, Date to) {
            return rate * (to.getTime() - from.getTime()) / 3600000;
        }
        public float getEstDuration(ValueAgg agg) {
            switch (agg) {
                case MIN:
                    return gainParams.minDuration;
                case AVG:
                    return gainParams.avgDuration;
                case MAX:
                    return gainParams.maxDuration;
                case STD:
                    return gainParams.stdDuration;
            }
            return gainParams.avgDuration;
        }
        public float getEstKwh(ValueAgg agg) {
            switch (agg) {
                case MIN:
                    return gainParams.minCharge;
                case AVG:
                    return gainParams.avgCharge;
                case MAX:
                    return gainParams.maxCharge;
                case STD:
                    return gainParams.stdCharge;
            }
            return gainParams.avgDuration;
        }
        public int getSessions() {
            return gainParams.sessions;
        }
        public String getDerivation() {
            return gainParams.derivation;
        }
        public float getEstDuration() {
            return getEstDuration(ValueAgg.AVG);
        }
        public float getEstKwh() {
            return getEstKwh(ValueAgg.AVG);
        }
        public JSONTable getParams() {
            return params;
        }
    }
    public class OffPeakUsage {
        private Date           ssStart        = null;   // Session start
        private Date           ssEnd          = null;   // session end        
        private Date           sopStart       = null;   // Session start that is within offpeak        
        private Date           sopEnd         = null;   // Session end that is within offpeak
        private String         provider       = null;
        private String         meter          = null;
        private String         action         = null;
        private Date           mtStart        = null;
        private double         ssKwh           = -1;
        private double         opKwhFromCost   = -1;
        private double         opKwhFromRatio  = -1;
        private double         opKwhFromApprox = -1;
        private Tariff         tf;
        private Tariff.OffPeak op;
        private double         opKwh           = -1;
        private String         opKwhDerivation = "";
        private double         cost            = -1;
        private boolean        supportsCredit  = false;
        private Context        ctx;
      
        private void setOpKwh(double kwh, String derivation) {
            opKwh           = Utils.round(kwh, 2);
            opKwhDerivation = derivation;
        }
        /*
         * Sets the appropriate variable for the different options for calculating the offpeak kwh.
         */
        private void setOpKwhOptions() throws SQLException, ParseException, JSONException {
            if (cost > 0 && tf.getUnitRate() > 0) {
                /*
                 * We can break down the session kwh into the part that takes in the off peak and the
                 * part that takes place in the peak. The following equations apply
                 *
                 *    pkRate * pkKwh + opRate * opKwh = 100 * cost
                 *    pkKwy + opKwh = ssKwh
                 *
                 * Solving them for opKwh gives the following.
                 */
                opKwhFromCost = Utils.round((100 * cost  - tf.getUnitRate() * ssKwh) / (tf.getOpRate() - tf.getUnitRate()), 2);
                
                if (!action.equalsIgnoreCase("openTableRow")) {
                    if (opKwhFromCost < 0)     errorExit("Cost " + cost + " produces a negative off peak Kwh value");
                    if (opKwhFromCost > ssKwh) errorExit("Cost " + cost + " produces a negative peak Kwh value");
                }
            }
            opKwhFromRatio = ssKwh * (sopEnd.getTime() - sopStart.getTime()) / (ssEnd.getTime() - ssStart.getTime());
            /*
             * Session overlaps off peak and end % > 95. 
             */
            ChargeEstimates    cp = new ChargeEstimates(ctx);
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
            if (ssStart.before(op.start)) {
                kwh -= cp.getKwh(ssStart, op.start);
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
        private void logUpdate(boolean close) throws SQLException, ParseException {  
            SQLBuilder sql = close? ctx.getInsertBuilder("ChargeSessionStats") : ctx.getDeleteBuilder("ChargeSessionStats");
            /*
             * In this method use ctx.getParameter("Start") rather than ssStart as ssStart may have been
             * normalised to GMT.
             */
            if (close) {
                sql.addField("SessionStart",    ctx.getTimestamp("Start"));
                sql.addField("Kwh",             ssKwh);
                sql.addField("OpKwh",           opKwh);
                sql.addField("OpDerivation",    opKwhDerivation);
                sql.addField("OpKwhFromCost",   opKwhFromCost);
                sql.addField("OpKwhFromRatio",  opKwhFromRatio);
                sql.addField("OpKwhFromApprox", opKwhFromApprox);
                sql.addField("Cost",            cost);
                
                if (tf != null) {
                    sql.addField("PkRate", tf.getUnitRate());
                    sql.addField("OpRate", tf.getOpRate());
                }                
                if (mtStart != null) sql.addField("MeterStart",   mtStart);
            } else {
                sql.addAnd("SessionStart", "=", ctx.getTimestamp("Start"));
            }
            executeUpdate(ctx, sql);
        }
        public void updateOffPeak(boolean close) throws SQLException, ParseException {
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
        public void close(boolean close) throws SQLException, ParseException {
            SQLUpdateBuilder sql  = ctx.getUpdateBuilder("ChargeSession");
            
            sql.addField("Closed", close? "Y" : "N");
            sql.addAnd("CarReg", "=", ctx.getParameter("CarReg"));
            sql.addAnd("Start",  "=", ctx.getTimestamp("Start"));
            executeUpdate(ctx, sql);
        }
        public OffPeakUsage(Context ctx) throws SQLException, ParseException, JSONException {            
            SQLSelectBuilder sql     = ctx.getSelectBuilder("ChargerLocation"); 
            EnclosingRecords er      = new EnclosingRecords(ctx, "MeterReading");
            ResultSet        rs;
            
            this.ctx     = ctx;
            this.ssStart = ctx.getTimestamp("Start");
            this.action  = ctx.getParameter("action");            
            this.ssKwh   = ctx.getDouble("Charge", -1);            
            this.cost    = ctx.getDouble("Cost", -1);
            
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
                
                rs.getDouble("Credit");
                supportsCredit = !rs.wasNull();
                return;
            }
            ssEnd = ctx.getTimestamp("End");
            
            tf = new Tariff(ctx.getAppDb(), "Electric", ssStart);
            
            /*
             * Convert ssStart and ssEnd to GMT to match the op settings that are defined as GMT
             */
            ssStart = tf.setOpTime(ssStart);
            ssEnd   = tf.setOpTime(ssEnd);
            
            Date opTime = new Date(ssEnd.getTime());
            
            op = tf.new OffPeak(opTime);
            
            if (tf.getStart() == null) errorExit("Tariff not found for " + ctx.getParameter("Start"));
            
            if (tf.getOpRate() <= 0) return;  // Tariff does not have off peak         
            /*
             * Check if session overlaps or surrounds the offpeak period for the session start day. This
             * will be the case if the the session end is after the off peak start and the session start is
             * before the offpeak end.
             *
             * Note: If the session is longer than a day there could be other offpeak areas
             *       in the session and the following calculations may not be accurate. So exit in this case.
             */
            if (DateFormatter.dateDiff(ssStart, ssEnd, DateFormatter.TimeUnits.Days) > 0) return;
            
            
            if (!(ssEnd.after(op.start) && ssStart.before(op.end))) return;

            
            sopStart = ssStart.before(op.start)? op.start : ssStart;
            sopEnd   = ssEnd.after(op.end)? op.end : ssEnd;
            setOpKwhOptions();
            /*
             * Calculate the Kwh for the overlapping part of the session. This is done to get the offpeak usage for
             * charging so the offpeak usage for billing can be estimated. This is not directly recorded by
             * the smart meter. The most part of the offpeak usage will be due to charging the car.
             */
            if (opKwhFromCost > -1) {
                setOpKwh(opKwhFromCost, "FromCost");  
            } else if (!ssStart.before(op.start) && !ssEnd.after(op.end) || ctx.getDouble("EndPerCent", 0) < 96) {
                /*
                 * This will be the majority of cases, as most of the charging takes place in the off peak.
                 */
                setOpKwh(opKwhFromRatio, "FromRatio");
            } else {
                setOpKwh(opKwhFromApprox, "FromApprox");
            }
            meter = getMeter(ctx, ssStart, "Electric");
            er.addField("Meter",     meter, true);
            er.addField("Timestamp", sopStart, false);

            if (er.getBefore() != null) {
                mtStart = ctx.getDateTime(er.getBefore(), "Timestamp");
            }
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
        
        if (action.equalsIgnoreCase("updateTableRow") && ctx.getTimestamp("Start") != ctx.getTimestamp("Key!Start")) {
            /*
             * The start time of the session has changed, so update session log to reflect this.
             */
            sql = ctx.getUpdateBuilder("ChargeSessionLog");
            
            sql.addField("Session", ctx.getTimestamp("Start"));
            sql.addAnd("CarReg",  "=", ctx.getParameter("CarReg"));
            sql.addAnd("Session", "=", ctx.getTimestamp("Key!Start"));
            
            executeUpdate(ctx, sql);
            /*
             * Update the timestamp of the first charge session log.
             */
            sql.clear();
            sql.addField("Timestamp", ctx.getTimestamp("Start"));
            sql.addAnd("CarReg",    "=", ctx.getParameter("CarReg"));
            sql.addAnd("Timestamp", "=", ctx.getTimestamp("Key!Start"));
            
            executeUpdate(ctx, sql);
        }
    }
    private void validateChangeSession(Context ctx,  String action) throws ParseException, SQLException {
        Date             start   = ctx.getTimestamp("Start");
        Date             end     = ctx.getTimestamp("End");
        Date             keyTime = ctx.getTimestamp("Key!Start");
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
    public void completeAction(Context ctx, boolean start) throws SQLException, ParseException, JSONException {        
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

        TimeZone.setDefault(TimeZone.getTimeZone("GMT"));
        
        switch (action) {
            case "getEstimates": {
                JSONTable       data = new JSONTable("Estimates");
                ChargeEstimates est  = new ChargeEstimates(ctx);
                
                data.add("EstMinKwh",      est.getEstKwh(ValueAgg.MIN), 2);
                data.add("EstAvgKwh",      est.getEstKwh(ValueAgg.AVG), 2);
                data.add("EstMaxKwh",      est.getEstKwh(ValueAgg.MAX), 2);
                data.add("EstStdKwh",      est.getEstKwh(ValueAgg.STD), 4);
                data.add("EstMinDuration", est.getEstDuration(ValueAgg.MIN), 4);
                data.add("EstAvgDuration", est.getEstDuration(ValueAgg.AVG), 4);
                data.add("EstMaxDuration", est.getEstDuration(ValueAgg.MAX), 4);
                data.add("EstStdDuration", est.getEstDuration(ValueAgg.STD), 4);
                data.add("EstSessions",    est.getSessions());
                data.add("EstDerivation",  est.getDerivation());
                data.add("Params",         est.getParams());

                data.append(ctx.getReplyBuffer(), "");
                break;
            }
            case "chargesessions":
                {
                    JSONTable        data = new JSONTable("ChargeSessions");
                    ResultSet        rs;
                    SQLSelectBuilder sql  = ctx.getSelectBuilder("ChargeSession");       
                    
                    sql.setProtocol(ctx.getAppDb().getProtocol());
                    sql.setMaxRows(config.getIntProperty("chargesessionrows", 100));
                    sql.addField("CarReg");
                    sql.addField("Start");
                    sql.addField("End");  
                    sql.addField("Weekday", sql.setExpressionSource(schema + ".WeekDayName(Start)"));
                    sql.addField("TargetPerCent");
                    sql.addField("EstDuration");
                    sql.addField("EstKwh");
                    sql.addField("Charger");
                    sql.addField("Unit");
                    sql.addField("Mileage");
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
                    data.load(rs);
                    data.append(ctx.getReplyBuffer(), "");
                    break;
                }
            case "chargers":
                {
                    JSONTable data = new JSONTable("Chargers");
                    ResultSet rs;

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
                    data.load(rs);
                    data.append(ctx.getReplyBuffer(), "");
                    break;
                }
            case "sessionlog": {
                JSONTable        data = new JSONTable("SessionLog");
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
