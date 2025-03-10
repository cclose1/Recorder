/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import org.cbc.sql.SQLSelectBuilder;
import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Date;
import java.util.TimeZone;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.Calendar;
import org.cbc.utils.system.DateFormatter;
/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public class RecordEnergy extends ApplicationServer {

    /*
         * Returns a new date from tumestamp with time set to 00:00:00.
     */
    private Date dateFromTimestamp(Date timestamp) {
        Date date = new Date(timestamp.getTime());

        Utils.zeroTime(date);

        return date;
    }
    private int[] unpackDate(Date date) {
        long time = date.getTime();
        long rem  = time / 1000;
        
        int[] flds = {0, 0, 0, 0, 0};
        
        flds[4] = (int)(time - 1000 * rem);
        time    = rem;
        rem     = time / 60;
        flds[3] = (int) (time - 60 * rem);
        time    = rem;
        rem     = time / 60;
        flds[2] = (int) (time - 60 * rem);
        time    = rem;
        rem     = time / 24;
        flds[1] = (int) (time - 24 * rem);
        flds[0] = (int) rem;
        return flds;
    }
    public final int getElapsedDaysOld(Date from, Date to) {
        return (int) DateFormatter.dateDiff(dateFromTimestamp(from), dateFromTimestamp(to), DateFormatter.TimeUnits.Days);
    }
    public final int getElapsedDays(Date from, Date to) {
        return (int)(to.getTime() / 1000 / 60 / 60 / 24 - from.getTime() / 1000 / 60 / 60 / 24);
    }
    private class Meter {
        private String identifier;
        private String type;
        private String deviceId;
        private Date   installed;
        private Date   removed;
        
        private void load(ResultSet rs) throws SQLException {
            if (rs.next()) {
                this.identifier = rs.getString("Identifier");
                this.type       = rs.getString("Type");
                this.deviceId   = rs.getString("DeviceId");
                this.installed  = rs.getTimestamp("Installed");                
                this.removed    = rs.getTimestamp("removed");
            }            
        }
        public Meter() {
            this.identifier = "undefined";
        }
        public Meter(DatabaseSession session, Date timestamp, String type) throws SQLException {
            String           ts  = session.getDateTimeString(timestamp);
            ResultSet        rs;
            SQLSelectBuilder sql = new SQLSelectBuilder("Meter", session.getProtocol());
            
            sql.addField("*");
            sql.addAnd("Type", "=", type);
            sql.addAnd("Installed", "<=", ts);
            sql.setWhere("AND ('" + ts + "' <= Removed OR Removed IS NULL)");
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            load(rs);
        }
        public Meter(DatabaseSession session, String identifier) throws SQLException {
            ResultSet        rs;
            SQLSelectBuilder sql = new SQLSelectBuilder("Meter", session.getProtocol());
            
            sql.addField("*");
            sql.addAnd("Identifier", "=", identifier);
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            load(rs);
        }
        public String getIdentifier() {
            return identifier;
        }
        public String getType() {
            return type;
        }
        public String getDeviceId() {
            return deviceId;
        }
        public Date getInstalled() {
            return installed;
        }
        public Date getRemoved() {
            return removed;
        }
    }
    private class MeterReading {
        private Date   timestamp;
        private double reading;
        private String type;
        private String meter;
        
        public MeterReading(String meter, Date timestamp, double reading) {
            this.timestamp = timestamp;
            this.reading   = reading;
            this.meter     = meter;
        }
        public MeterReading(ResultSet rs) throws SQLException {
            this(rs.getString("Meter"), rs.getTimestamp("Timestamp"), rs.getDouble("Reading"));
        }
        public Date getTimestamp() {
            return timestamp;
        }
        public double getReading() {
            return reading;
        }
        public String getType() {
            return type;
        }
    }
    private class EnergyCost {
        private float  meterChange = 0;  
        private float  opCost      = 0;
        private float  opKwh       = 0;
        private float  peakCost    = 0;
        private float  peakKwh     = 0;
        private double stdCost     = 0;
        private Date   smStart     = null;
        private Date   smPrev      = null;
        private Date   smEnd       = null;
        private int    usageCount  = 0;
        private long   hours       = 0;
        
        public EnergyCost(DatabaseSession session, Date from, Date to, String type) throws SQLException, ParseException {
            Tariff           tf  = new Tariff(session, type);
            Tariff.OffPeak   op  = tf.new OffPeak(new Date());
            ResultSet        rs;
            SQLSelectBuilder sql = new SQLSelectBuilder("SmartMeterUsageData", session.getProtocol());
        
            sql.addField("Timestamp");
            sql.addAnd("Type",       "=", type);
            sql.addAnd("Timestamp", "<=", from);
            sql.addOrderByField("Timestamp", true);
            sql.setMaxRows(1);
                        
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            
            if (!rs.next()) return;
        
            sql.clear();
            sql.addField("*");
            sql.addAnd("Type",       "=", type);
            sql.addAnd("Timestamp", ">=", rs.getTimestamp("Timestamp"));
            sql.addOrderByField("Timestamp", false);
             
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            
            while (rs.next()) {
                Date   smTime  = rs.getTimestamp("Timestamp");
                float  reading = rs.getFloat("Reading");
                double smKwh   = tf.readingToKwh(reading);
                        
                if (to != null && smTime.after(to)) break;
            
                tf.load(smTime);
            
                if (smStart == null) smStart = new Date(smTime.getTime());  
                if (smEnd   == null) smEnd   = new Date();
            
                smEnd.setTime(smTime.getTime());
                meterChange += reading;
            
                if (op.isOffPeak(smTime)) {
                    opKwh  += smKwh;
                    opCost += smKwh * tf.getOpRate();
                } else {                
                    peakKwh  += smKwh;
                    peakCost += smKwh * tf.getUnitRate();
                }
                if (smPrev == null || getElapsedDays(smPrev, smTime) == 1) stdCost  += tf.getStandingCharge();
                
                smPrev = smTime;
                usageCount++;
            }
            hours    = DateFormatter.dateDiff(smStart, smEnd, DateFormatter.TimeUnits.Hours);
            stdCost  = tf.getStandingCharge() * getElapsedDays(smStart, smEnd);
        }
        public float getMeterChange() {
            return meterChange;
        }
        public float getOpCost() {
            return opCost;
        }
        public float getOpKwh() {
            return opKwh;
        }
        public float getPeakCost() {
            return peakCost;
        }
        public float getPeakKwh() {
            return peakKwh;
        }
        public double getStdCost() {
            return stdCost;
        }
        public Date getSmStart() {
            return smStart;
        }
        public Date getSmEnd() {
            return smEnd;
        }
        public int getUsageCount() {
            return usageCount;
        }
        public long getHours() {
            return hours;
        }
    }
    private class DeriveMeterReading {
        LocalErrorExit   exit   = new LocalErrorExit("CreateMeterReading", "");     
        Date             timestamp;
        String           type;
        double           toReading;
        MeterReading     start;
        Meter            meter         = new Meter();
        double           reading       = 0;
        int              increments    = 0;
        Date             lastIncrement = timestamp;
        boolean          complete      = false;
        String           error         = "";
        
        private void error(String message) {
            StringBuilder report = new StringBuilder("For ");
            
            report.append(DateFormatter.format(timestamp, "dd-MMM-yyy HH:mm"));
            
            if (start != null) {
                report.append(" prior ");
                report.append(DateFormatter.format(start.getTimestamp(), "dd-MMM-yyy HH:mm"));
                report.append(" reading ");
                report.append(start.getReading());
            }
            report.append(' ');
            report.append(message);
            
            exit.throwMessage(report.toString());
        }
        private MeterReading getNearestMeterReading(DatabaseSession session, Date timestamp, String type) throws SQLException, ParseException {
            ResultSet        rs;
            SQLSelectBuilder sql   = new SQLSelectBuilder("MeterReading", session.getProtocol());
            
            meter = new Meter(session, timestamp, type);
        
            sql.addField("Timestamp");
            sql.addField("Reading");
            sql.addField("Meter");
            sql.addAnd("Meter",     "=",  meter.getIdentifier());
            sql.addAnd("Timestamp", "<=", timestamp);
            sql.addOrderByField("Timestamp", true);
            sql.setMaxRows(1);
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
       
            if (!rs.next()) return null;
        
            return new MeterReading(rs);
        }
        public DeriveMeterReading(DatabaseSession session, Date timestamp, String type, double targetReading) throws SQLException, ParseException {            
            SQLSelectBuilder sql    = new SQLSelectBuilder("SmartMeterUsageData", session.getProtocol());
            ResultSet        rs;
            this.timestamp = timestamp;
            this.type      = type;
            this.toReading = targetReading;
            
            start = getNearestMeterReading(session, timestamp, this.type);
            
            try {
                if (start == null) error("No prior meter reading");
                
                meter   = new Meter(session, start.meter);
                reading = start.getReading();
                
                if (targetReading > 0 && targetReading < reading) error("Prior reading is after target " + targetReading);
                
                sql.addField("*");
                sql.addAnd("Type",       "=", type);
                sql.addAnd("Timestamp", ">=", start.getTimestamp());

                rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);

                while (rs.next()) {
                    double increment = rs.getDouble("Reading");
                    Date   usageTime = rs.getTimestamp("Timestamp");

                    complete = true;
                    
                    if (meter.getRemoved() != null && usageTime.after(meter.getRemoved()))
                        error("Calculated time " + DateFormatter.format(usageTime, "dd-MMM-yyy HH:MM") + " beyond meter " + meter.getIdentifier());
                
                    if (toReading >  0 && reading + increment > toReading) break;
                    if (toReading <= 0 && usageTime.after(timestamp)) break;
                
                    increments++;
                    complete = false;
                    reading += increment;;

                    if (lastIncrement == null || 
                        increment > 0         || 
                        getElapsedDays(lastIncrement, usageTime) == 1) lastIncrement = usageTime;
                }
                if (lastIncrement == null) error("No SmartMeterUsageData available");
                
                if (!complete) error("Not enough SmartMeterUsageData available");
            
                long hours = DateFormatter.dateDiff(start.getTimestamp(), lastIncrement, DateFormatter.TimeUnits.Hours);

                if (2 * hours - increments > 5)
                    error("Time gap " + hours + " but only " + increments + " SmartMeterUsageData values available");
            
            } catch (LocalErrorExit ex) {
                error = ex.getReason();
            }
        }
        public Date getPriorTimestamp() {
            return start == null? null : start.getTimestamp();
        }
        public double getPriorReading() {
            return start == null? 0 : start.getReading();
        }
        public Date getTimestamp() {
            return lastIncrement;
        }
        public double getReading() {
            return reading;
        }
        public String getMeterId() {
            return meter.getIdentifier();
        }
        public String getError() {
            return error;
        }
    }
    private SQLSelectBuilder getReadingsSQL(Context ctx, String readings) throws SQLException {
        SQLSelectBuilder sel;

        if (readings.equals("Meter")) {
            sel = ctx.getSelectBuilder(null);

            sel.addField("Timestamp");
            sel.addField("Weekday");
            sel.addField("Reading");
            sel.addField("Meter");
            sel.addField("Type");
            sel.addField("Status",     sel.setValue(""));
            sel.addField("Source",     sel.setValue(""));
            sel.addField("Comment",    sel.setFieldSource("MR.Comment"), sel.setValue(""));
            sel.setFrom("MeterReading AS MR LEFT JOIN Meter AS MT ON Meter = Identifier");
            sel.setOrderBy("Timestamp DESC, Meter");
        } else {
            sel = ctx.getSelectBuilder("BoundedReading");

            sel.addField("Start");
            sel.addField("Weekday");
            sel.addField("Days");
            sel.addField("Type");
            sel.addField("StartReading");
            sel.addField("StartEstimated");
            sel.addField("EndReading");
            sel.addField("Kwh");
            sel.addField("Comment", sel.setValue(""));
            sel.setOrderBy("Start DESC, Type");
        }
        sel.setMaxRows(config.getIntProperty("spendhistoryrows", 100));
        sel.addAnd(ctx.getParameter("filter"));

        return sel;
    }
    private SQLSelectBuilder getTariffsSQL(Context ctx) throws SQLException {
        SQLSelectBuilder sel = ctx.getSelectBuilder("Tariff");

        sel.addField("Code");
        sel.addField("Start");
        sel.addField("End");
        sel.addField("Type");
        sel.addField("UnitRate");
        sel.addField("OffPeakRate");
        sel.addField("OffPeakStart");
        sel.addField("OffPeakEnd");
        sel.addField("StandingCharge");
        sel.addField("CalorificValue");
        sel.addField("Comment");
        sel.setOrderBy("Start DESC, Type");
        sel.setMaxRows(config.getIntProperty("spendhistoryrows", 100));
        sel.addAnd(ctx.getParameter("filter"));

        return sel;
    }

    @Override
    public String getVersion() {
        return "V2.2 Released 05-Dec-18";
    }

    @Override
    public void initApplication(ServletConfig config, ApplicationServer.Configuration.Databases databases) throws ServletException, IOException {
        databases.setApplication(
                super.config.getProperty("endatabase"),
                super.config.getProperty("enuser"),
                super.config.getProperty("enpassword"));

    }
    @Override
    protected void completeAction(Context ctx, boolean start) throws SQLException, ErrorExit, ParseException {
        String action        = ctx.getParameter("action");
        SQLUpdateBuilder sql = null;
        
        if (start) return;
        
        if (!(action.equals("deleteTableRow") && ctx.getParameter("table").equals("Tariff"))) return;
        
        sql = ctx.getUpdateBuilder(ctx.getParameter("table"));
        
        sql.addAnd("End", "=", ctx.getTimestamp("Start"));
        sql.addAnd("Code", "=", ctx.getParameter("Code"));        
        sql.addAnd("Type", "=", ctx.getParameter("Type"));
        
        sql.addField("End");
        
        executeUpdate(ctx, sql);
    }
    private boolean addTariff(Context ctx, String type) throws ParseException, SQLException {
        SQLInsertBuilder sql      = ctx.getInsertBuilder("Tariff");
        EnclosingRecords er       = new EnclosingRecords(ctx, "Tariff");
        Date             start    = ctx.getTimestamp("Date");
        double           rate     = ctx.getDouble(type + " UnitRate",       -1);
        double           standing = ctx.getDouble(type + " StandingCharge", -1);
        double           offpeak  = ctx.getDouble(type + " OffPeakRate",    -1);
        ResultSet upper;
        ResultSet lower;

        if (rate < 0) return false;

        er.addField("Code",  ctx.getParameter("Code"),  true);
        er.addField("Type",  type,                      true);
        er.addField("Start", start,                     false);

        upper = er.getAfter();

        if (upper != null) {
            throw new ErrorExit("Must be after latest tarriff record");
        }
        lower = er.getBefore();
   
        if (lower != null) { 
            if (start.equals(lower.getDate("Start"))) throw new ErrorExit("Tariff already exists for this date");
            
            lower.updateDate("End", ctx.getSQLDate(start));
            lower.updateRow();
        }        
        sql.addField("Start",          start);
        sql.addField("Type",           type);        
        sql.addField("Code",           ctx.getParameter("Code"));
        sql.addField("StandingCharge", standing);
        sql.addField("UnitRate",       rate);
        
        if (offpeak < 0 ) {
            sql.addField("OffPeakRate");
            sql.addField("OffPeakStart");
            sql.addField("OffPeakEnd");
        }
        else {
            sql.addField("OffPeakRate",  offpeak);
            sql.addField("OffPeakStart", ctx.getParameter(type + " " + "OffPeakStart"));
            sql.addField("OffPeakEnd",   ctx.getParameter(type + " " + "OffPeakEnd"));
        }        
        sql.addField("Comment",        ctx.getParameter("Comment"));
        
        if (type.equalsIgnoreCase("gas")) sql.addField("CalorificValue", ctx.getParameter("CalorificValue"));
        
        executeUpdate(ctx, sql);
        return true;
    }
    private void deriveMeterReading(Context ctx) throws SQLException, ParseException, JSONException {   
        DeriveMeterReading dmr = new DeriveMeterReading(
                ctx.getAppDb(),
                ctx.getTimestamp("Timestamp"),
                ctx.getParameter("Type"),
                ctx.getDouble("Reading", -1)); 
        JSONObject data = new JSONObject();       

        data.add("PriorTimestamp", ctx.getDbTimestamp(dmr.getPriorTimestamp()));
        data.add("PriorReading",   dmr.getPriorReading(), 3);
        data.add("Timestamp",      ctx.getDbTimestamp(dmr.getTimestamp()));
        data.add("Reading",        dmr.getReading(), 3);
        data.add("Identifier",     dmr.getMeterId());
        data.add("Comment",        dmr.getError());
        data.append(ctx.getReplyBuffer(), "");   
    }
    private void calculateCosts(Context ctx) throws SQLException, ParseException, JSONException {  
        EnergyCost ec   = new EnergyCost(ctx.getAppDb(), ctx.getTimestamp("Start"), ctx.getTimestamp("End"), ctx.getParameter("Type"));
        JSONObject data = new JSONObject();
        
        data.add("MeterChange",    ec.getMeterChange(), 2);
        data.add("OffPeakCost",    ec.getOpCost()/100,  2);
        data.add("OffPeakKwh",     ec.getOpKwh(),       2);
        data.add("PeakCost",       ec.getPeakCost()/100,2);
        data.add("PeakKwh",        ec.getPeakKwh(),     2);
        data.add("StandingCharge", ec.getStdCost()/100, 2);
        data.add("TotalCost",      (ec.getPeakCost() + ec.getOpCost() + ec.getStdCost())/100, 2);
        data.add("ValuesUsed",     ec.getUsageCount());
        data.append(ctx.getReplyBuffer(), "");
    }
    private boolean addReading(Context ctx, String type) throws SQLException, ParseException {
        SQLInsertBuilder sql       = ctx.getInsertBuilder("MeterReading");
        EnclosingRecords er        = new EnclosingRecords(ctx, "MeterReading");
        Date             timestamp = ctx.getTimestamp("Date", "Time");
        String           meter     = (new Meter(ctx.getAppDb(), timestamp, type)).getIdentifier();
        double           reading   = ctx.getDouble(type,       -2);
        String           status    = ctx.getParameter("Status");
        String           source    = ctx.getParameter("Source");
        ResultSet        upper;
        ResultSet        lower;
        double           minReading = -1;
        double           maxReading = -1;
        
        if (reading <= -2) return false;

        er.addField("Meter",     meter,     true);
        er.addField("Timestamp", timestamp, false);
        
        lower = er.getBefore();
        upper = er.getAfter();
        lower = er.getBefore();
        
        if (lower != null) minReading = lower.getDouble("Reading");
        if (upper != null) maxReading = upper.getDouble("Reading");
        if (reading >= 0) {
            /*
             * Reading provided so check if between lower and upper.
             */
            if (minReading >= 0 && reading < minReading) 
                errorExit(type + " reading  must be greater than " + minReading);
            if (maxReading >= 0 && reading >= maxReading) 
                errorExit(type + " reading must be less than " + maxReading);
        } else {
            /*
             * Calculate reading by interpolating between lower and upper.
             */
            if (lower == null || upper == null)
                errorExit("Estimating a " + type + " reading, requires it's time lies between 2 readings");
            
            int days      = Calendar.daysBetween(lower.getDate("Timestamp"), upper.getDate("Timestamp"));
            int dayOffset = Calendar.daysBetween(lower.getDate("Timestamp"), timestamp);
            
            reading   = minReading + (maxReading - minReading) * dayOffset / days;
            status = "";
        }
        sql.addField("Timestamp", timestamp);
        sql.addField("Meter",     meter);
        sql.addField("Reading",   reading);
        sql.addField("Status",    status);
        sql.addField("Source",    source);
        sql.addField("Comment",   ctx.getParameter("Comment"));
        executeUpdate(ctx, sql);

        return true;
    }
    @Override
    public void processAction(
            Context ctx,
            String action) throws ServletException, IOException, SQLException, JSONException, ParseException {        
        SQLSelectBuilder sel;
        SQLDeleteBuilder del;
        JSONObject       data   = new JSONObject();
        boolean          commit = false;
        String           readings;
        ResultSet        rs;
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
                if (addReading(ctx, "Gas"))      commit = true;
                if (addReading(ctx, "Electric")) commit = true;
                if (addReading(ctx, "Export"))   commit = true;                
                if (addReading(ctx, "Solar"))    commit = true;
                
                if (!commit) throw new ErrorExit("At least 1 reading is required");
                
                ctx.getAppDb().commit();
                ctx.setStatus(200);
                break;
            case "Delete":
                del = ctx.getDeleteBuilder("MeterReading");
                del.addAnd("Timestamp", "=", ctx.getTimestamp("Date", "Time"));
                del.addAnd("Meter",     "=", ctx.getParameter("Meter"));
                executeUpdate(ctx, del.build());
                ctx.getAppDb().commit();
                ctx.setStatus(200);
                break;
            case "readingshistory":
                readings = ctx.getParameter("readings");
                sel      = getReadingsSQL(ctx, readings);
                rs       = executeQuery(ctx, sel);
                data.add(readings, rs);
                data.append(ctx.getReplyBuffer());
                ctx.setStatus(200);
                break;
            case "tariffs":
                sel = getTariffsSQL(ctx);
                rs = executeQuery(ctx, sel);
                data.add("tariffs", rs);
                data.append(ctx.getReplyBuffer());
                ctx.setStatus(200);
                break;
            case "CreateTariff":
                ctx.getAppDb().startTransaction();
                
                boolean gas = addTariff(ctx, "Gas");                
                boolean elc = addTariff(ctx, "Electric");
                
                if (!gas && !elc) errorExit("Tariff details must be provide for at least 1 of Gas or Electric");
                
                ctx.getAppDb().commit();
                ctx.setStatus(200);
                break;
            case "DeleteTariff":
                break;
            case "getList":
                getList(ctx);
                break;
            case "deriveReading":
                deriveMeterReading(ctx);
                break;
            case "calculateCosts":
                calculateCosts(ctx);
                break;
            default:
                invalidAction();
                break;
        }
    }
}
