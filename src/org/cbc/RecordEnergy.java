/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import org.cbc.sql.SQLSelectBuilder;
import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLBuilder;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
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
        public boolean timeInMeter(Date timestamp) {
            return timestamp.after(installed) && (removed == null || timestamp.before(removed));
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
        private DatabaseSession session;
        private Date   timestamp;
        private double reading;
        private String type;
        private String meter;
        private String status;
        private String source;
        private String comment;
        
        private long secondsBetween(Date from, Date to) {
            return DateFormatter.dateDiff(from, to, DateFormatter.TimeUnits.Seconds);
        }
        public MeterReading(DatabaseSession session, Date   timestamp, String meter) {
            this.session   = session;
            this.timestamp = timestamp;
            this.meter     = meter;            
        }
        public MeterReading(
                DatabaseSession session,
                Date   timestamp,
                String meter,
                double reading,
                String status,
                String source,
                String comment) {
            this(session, timestamp, meter);
            this.reading = reading;
            this.status  = status;
            this.source  = source;
            this.comment = comment;                    
        }
        public MeterReading(DatabaseSession session, ResultSet rs) throws SQLException {
            this(session, rs.getTimestamp("Timestamp"),
                 rs.getString("Meter"), 
                 rs.getDouble("Reading"),
                 rs.getString("Status"),
                 rs.getString("Source"),
                 rs.getString("Comment"));
        }
        public Date getTimestamp() {
            return timestamp;
        }
        public double getReading() {
            return reading;
        }
        public String getType() {
            return type;
        }        public void setTimestamp(Date timestamp) {
            this.timestamp = timestamp;
        }
        public void setReading(double reading) {
            this.reading = reading;
        }
        public void setType(String type) {
            this.type = type;
        }
        public String getMeter() {
            return meter;
        }
        public void setMeter(String meter) {
            this.meter = meter;
        }
        public String getStatus() {
            return status;
        }
        public void setStatus(String status) {
            this.status = status;
        }
        public String getSource() {
            return source;
        }
        public void setSource(String source) {
            this.source = source;
        }
        public String getComment() {
            return comment;
        }
        public void setComment(String comment) {
            this.comment = comment;
        } 
        public void validate() throws SQLException {
            EnclosingRecords er = new EnclosingRecords(session, "MeterReading");
            ResultSet upper;
            ResultSet lower;
            double minReading   = -1;
            double maxReading   = -1;

            er.addField("Meter", getMeter(),     true);
            er.addField("Timestamp", getTimestamp(), false);

            lower = er.getBefore(false);
            upper = er.getAfter(false);

            if (lower != null) {
                minReading = lower.getDouble("Reading");
            }
            if (upper != null) {
                maxReading = upper.getDouble("Reading");
            }
            if (getReading() >= 0) {
                /*
                 * Reading provided so check if between lower and upper.
                 */
                if (minReading >= 0 && getReading() < minReading) {
                    errorExit(getType() + " reading  must be greater than " + minReading);
                }
                if (maxReading >= 0 && getReading() >= maxReading) {
                    errorExit(getType() + " reading must be less than " + maxReading);
                }
            } else {
                /*
                 * Calculate reading by interpolating between lower and upper.
                 */
                if (lower == null || upper == null) {
                    errorExit("Estimating a " + getType() + " reading, requires it's time lies between 2 readings");
                } else {
                    long seconds   = secondsBetween(lower.getTimestamp("Timestamp"), upper.getTimestamp("Timestamp"));
                    long secOffset = secondsBetween(lower.getTimestamp("Timestamp"), getTimestamp());

                    setReading(minReading + (maxReading - minReading) * secOffset / seconds);
                    setSource("Estimated");
                }
            }
        }
        private void setKey(SQLBuilder sql) throws SQLException {            
            sql.addAnd("timestamp", "=", timestamp);
            sql.addAnd("Meter",     "=", meter);
        }
        private void addDataFields(SQLBuilder sql, boolean onlyReading) {
            sql.addField("Timestamp", timestamp);
            sql.addField("Meter",     meter);
            sql.addField("Reading",   reading);
            
            if (onlyReading) return;
            
            sql.addField("Status",    status);
            sql.addField("Source",    source);
            sql.addField("Comment",   comment);
        }
        public void create() throws SQLException {
            SQLInsertBuilder sql = new SQLInsertBuilder("MeterReading", session.getProtocol());
            addDataFields(sql, false);
            session.executeUpdate(sql.build());
        }
        public void update(boolean onlyReading) throws SQLException {
            SQLUpdateBuilder sql = new SQLUpdateBuilder("MeterReading", session.getProtocol());
            
            setKey(sql);
            addDataFields(sql, onlyReading);
            session.executeUpdate(sql.build());
        }        
        public void delete() throws SQLException {
            SQLDeleteBuilder sql = new SQLDeleteBuilder("MeterReading", session.getProtocol());
            
            setKey(sql);
            session.executeUpdate(sql.build());
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
        private Tariff tf;
        
        public EnergyCost(DatabaseSession session, Date from, Date to, String type) throws SQLException, ParseException {
            Tariff.OffPeak   op;
            ResultSet        rs;
            SQLSelectBuilder sql = new SQLSelectBuilder("SmartMeterUsageData", session.getProtocol());
        
            tf = new Tariff(session, type);
            op = tf.new OffPeak(new Date());
            sql.addField("Timestamp");
            sql.addAnd("Type",       "=", type);
            sql.addAnd("Timestamp", "<=", from);
            sql.addOrderByField("Timestamp", true);
            sql.setMaxRows(1);
                        
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            
            if (!rs.next()) return;
        
            sql.clear();
            sql.addField("*");
            sql.addAnd("Type",   "=", type);
            sql.addAnd("Start", ">=", rs.getTimestamp("Timestamp"));
            sql.addOrderByField("Timestamp", false);
             
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            
            while (rs.next()) {
                Date   smTime  = rs.getTimestamp("Start");
                float  reading = rs.getFloat("Reading");
                double smKwh;
                        
                if (to != null && smTime.after(to)) break;
            
                tf.load(smTime);
                
                smKwh = tf.readingToKwh(reading);
            
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
        public double getUnitRate() {
            return tf.getUnitRate();
        }
        public double getOpRate() {
            return tf.getOpRate();
        }
        public double getStandingCharge() {
            return tf.getStandingCharge();
        }  
        public double getCalorificValue() {
            return tf.getCalValue();
        }  
    }
    private class DeriveMeterReading {
        LocalErrorExit   exit   = new LocalErrorExit("CreateMeterReading", "");     
        Date             from;    
        Date             to;
        double           toReading;
        String           type;
        double           offset;
        MeterReading     start;
        Meter            meter         = new Meter();
        double           reading       = 0;
        int              increments    = 0;
        Date             lastIncrement = from;
        boolean          complete      = false;
        String           error         = "";
        
        private void error(String message) {
            StringBuilder report = new StringBuilder("For ");
            
            report.append(DateFormatter.format(from, "dd-MMM-yyy HH:mm"));
            
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
        private MeterReading getNearestMeterReading(
                DatabaseSession session, 
                Date            timestamp, 
                String          type,
                String          status) throws SQLException, ParseException {
            ResultSet        rs;
            SQLSelectBuilder sql   = new SQLSelectBuilder("MeterReading", session.getProtocol());
            
            meter = new Meter(session, timestamp, type);
        
            sql.addField("Timestamp");
            sql.addField("Reading");
            sql.addField("Meter");
            sql.addField("Status");
            sql.addField("Source");
            sql.addField("Comment");
            sql.addAnd("Meter",     "=",  meter.getIdentifier());
            sql.addAnd("Timestamp", "<=", timestamp);
            
            if (!status.equals("")) sql.addAnd("Status", "=", status);
            
            sql.addOrderByField("Timestamp", true);
            sql.setMaxRows(1);
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
       
            if (!rs.next()) return null;
        
            return new MeterReading(session, rs);
        }
        public DeriveMeterReading(
                DatabaseSession session, 
                String          type, 
                Date            from, 
                Date            to,
                double          targetReading, 
                double          offset,
                boolean         useVerified) throws SQLException, ParseException {            
            SQLSelectBuilder sql    = new SQLSelectBuilder("SmartMeterUsageData", session.getProtocol());
            ResultSet        rs;
            
            this.from      = from;
            this.to        = to;
            this.toReading = targetReading;
            this.type      = type;
            this.offset    = offset;
            this.reading   = offset;
            
            start = getNearestMeterReading(session, from, this.type, useVerified? "Verified" : "");
            
            try {
                boolean up = true;
                
                if (start == null) error("No prior meter reading");
                
                meter   = new Meter(session, start.getMeter());
                reading = start.getReading();
                
                if (to != null)
                    up = to.after(start.getTimestamp());
                else
                    up = toReading > reading;
                
                reading += offset;
                
                sql.addField("*");
                sql.addAnd("Type",                  "=", type);
                sql.addAnd("Timestamp", up? ">=" : "<=", start.getTimestamp());
                sql.addOrderByField("Timestamp", !up);
                
                rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);

                while (rs.next()) {
                    double increment = rs.getDouble("Reading");
                    Date   usageTime = rs.getTimestamp("Timestamp");

                    complete = true;
                    
                    if (!meter.timeInMeter(usageTime))
                        error("Calculated time " + DateFormatter.format(usageTime, "dd-MMM-yyy HH:MM") + " beyond meter " + meter.getIdentifier());
                
                    if (up) {
                        if (toReading > 0  && reading + increment > toReading) break;
                        if (toReading <= 0 && usageTime.after(to)) break;
                        
                        reading += increment;
                    } else {
                        if (toReading > 0  && reading +- increment < toReading) break;
                        if (toReading <= 0 && usageTime.before(to)) break;
                        
                        reading -= increment;
                    }                
                    increments++;
                    complete = false;

                    if (lastIncrement == null || 
                        increment > 0         || 
                        getElapsedDays(lastIncrement, usageTime) == 1) lastIncrement = usageTime;
                }
                if (lastIncrement == null) error("No SmartMeterUsageData available");
                
                if (!complete) error("Not enough SmartMeterUsageData available");
            
                long hours = DateFormatter.dateDiff(start.getTimestamp(), lastIncrement, DateFormatter.TimeUnits.Hours);

                if (!up) hours *= -1;
                
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
        EnclosingRecords er       = new EnclosingRecords(ctx.getAppDb(), "Tariff");
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
                
        executeUpdate(ctx, sql);
        return true;
    }
    private void deriveMeterReading(Context ctx) throws SQLException, ParseException, JSONException {   
        DeriveMeterReading dmr = new DeriveMeterReading(
                ctx.getAppDb(),
                ctx.getParameter("Type"),
                ctx.getTimestamp("From"),
                ctx.getTimestamp("To"),
                ctx.getDouble("ToReading", -1),
                ctx.getDouble("Offset", 0),
                ctx.getParameter("UseVerified").equals("true")); 
        JSONObject data = new JSONObject(); 

        data.add("PriorTimestamp", ctx.getDbTimestamp(dmr.getPriorTimestamp()));
        data.add("PriorReading",   dmr.getPriorReading(), 3);
        data.add("Timestamp",      ctx.getDbTimestamp(dmr.getTimestamp()));
        data.add("Reading",        dmr.getReading(), 3);
        data.add("Meter",          dmr.getMeterId());
        data.add("Comment",        dmr.getError());
        data.append(ctx.getReplyBuffer(), "");   
    }
    private void calculateCosts(Context ctx) throws SQLException, ParseException, JSONException {  
        EnergyCost ec   = new EnergyCost(ctx.getAppDb(), ctx.getTimestamp("Start"), ctx.getTimestamp("End"), ctx.getParameter("Type"));
        JSONObject data = new JSONObject();
        
        data.add("MeterChange",    ec.getMeterChange(),    2);
        data.add("OffPeakCost",    ec.getOpCost()/100,     2);
        data.add("OffPeakKwh",     ec.getOpKwh(),          2);
        data.add("PeakCost",       ec.getPeakCost()/100,   2);
        data.add("PeakKwh",        ec.getPeakKwh(),        2);
        data.add("StandingCost",   ec.getStdCost()/100,    2);
        data.add("StandingCharge", ec.getStandingCharge(), 2);
        data.add("UnitRate",       ec.getUnitRate(),       2);
        data.add("OffPeakRate",    ec.getOpRate(),         2);
        data.add("CalorificValue", ec.getCalorificValue(), 2);
        data.add("TotalCost",      (ec.getPeakCost() + ec.getOpCost() + ec.getStdCost())/100, 2);
        data.add("ValuesUsed",     ec.getUsageCount());
        data.append(ctx.getReplyBuffer(), "");
    }    
    private void calorificValueX(Context ctx) throws SQLException, ParseException, JSONException {
        String operation = ctx.getParameter("Operation");
        Date   date      = ctx.getTimestamp("Date");
        double value     = ctx.getDouble("Value", -1);
        
        switch (operation) {
            case "Create":
                break;
            case "Modify":
                break;
            case "Delete":
                break;
            default:
                throw new ErrorExit("CalorificValue operation " + operation + " invalid");
        }
    }
    private MeterReading fromRequest(Context ctx, boolean keyOnly) throws ParseException {
        MeterReading reading = new MeterReading(ctx.getAppDb(), ctx.getTimestamp("Timestamp"), ctx.getParameter("Meter"));
        
        if (!keyOnly) {
            reading.setReading(ctx.getDouble("Reading", -1));
            reading.setStatus(ctx.getParameter("Status"));
            reading.setSource(ctx.getParameter("Source"));
            reading.setComment(ctx.getParameter("Comment"));
        }
        return reading;
    }
    private boolean addReading(Context ctx, String type) throws SQLException, ParseException {
        String  meterId      = (new Meter(ctx.getAppDb(), ctx.getTimestamp("Timestamp"), type)).getIdentifier();
        String  timeOffset   = ctx.getParameter("TimeOffset");
        Date    timestamp    = ctx.getTimestamp("Timestamp");
        
        if (timeOffset.equalsIgnoreCase("Local")) {
            /*
             * Need to convert to GMT. The following will produce the correct result
             * if not in BST.
             */
            timestamp = timeWithDate.toGMT(timestamp);
        }
        MeterReading meterReading = new MeterReading( 
                                            ctx.getAppDb(),
                                            timestamp,
                                            meterId,
                                            ctx.getDouble(type, -2),
                                            ctx.getParameter("Status"),
                                            ctx.getParameter("Source"),
                                            ctx.getParameter("Comment"));
        
        if (meterReading.getReading() <= -2) return false;
        
        meterReading.validate();
        meterReading.create();
        return true;
    }
    private Date test(Date timestamp) {
        Date gmt = timeWithDate.toGMT(timestamp);
        
        timeWithDate.setInstantFromLocal(timestamp);
        return timeWithDate.getDate();
    }
    @Override
    public void processAction(
            Context ctx,
            String action) throws ServletException, IOException, SQLException, JSONException, ParseException {        
        SQLSelectBuilder sel;
        JSONObject       data   = new JSONObject();
        boolean          commit = false;        
        MeterReading     reading;
        String           readings;
        ResultSet        rs;
        Date             tDate;
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

        DateFormat pf = new SimpleDateFormat("yy-MM-dd'T'HH:mm:ssXXX");
        tDate = pf.parse("2025-05-01T00:30:00+01:00");
        tDate = test(DateFormatter.parseDate("2025-01-02"));
        tDate = test(DateFormatter.parseDate("01-Apr-25"));
        tDate = test(DateFormatter.parseDate("31-Mar-25 00:00"));
        tDate = test(DateFormatter.parseDate("31-Mar-25 01:00"));
        tDate = test(DateFormatter.parseDate("31-Mar-25 02:00"));
        tDate = DateFormatter.parseDate("2025-05-01T00:30:00+01:00");
        switch (action) {
            case "Create":
                if (addReading(ctx, "Gas"))      commit = true;
                if (addReading(ctx, "Electric")) commit = true;
                if (addReading(ctx, "Export"))   commit = true;                
                if (addReading(ctx, "Solar"))    commit = true;
                
                if (!commit) throw new ErrorExit("At least 1 reading is required");
                
                break;               
            case "Modify":            
            case "ModifyReading":
                reading = fromRequest(ctx, false);                
                reading.validate();
                reading.update(action.equals("ModifiyReading"));
                break;
            case "Delete":
                reading = fromRequest(ctx, true);                 
                reading.delete();
                break;
            case "Apply":
                reading = fromRequest(ctx, false);                
                reading.validate();
                reading.create();;
                break;
            case "readingshistory":
                readings = ctx.getParameter("readings");
                sel      = getReadingsSQL(ctx, readings);
                rs       = executeQuery(ctx, sel);
                data.add(readings, rs);
                data.append(ctx.getReplyBuffer());
                break;
            case "calvals":
                sel = ctx.getSelectBuilder("CalorificValue");
                
                sel.addField("Date");
                sel.addField("Value");
                sel.addField("Comment");
                sel.addOrderByField("Date", true);
                
                rs  = executeQuery(ctx, sel);
                data.add("CalVals", rs);
               
                data.append(ctx.getReplyBuffer());
                break;
            case "tariffs":
                sel = getTariffsSQL(ctx);
                rs  = executeQuery(ctx, sel);
                data.add("tariffs", rs);
                data.append(ctx.getReplyBuffer());
                break;
            case "CreateTariff":
                ctx.getAppDb().startTransaction();
                
                boolean gas = addTariff(ctx, "Gas");                
                boolean elc = addTariff(ctx, "Electric");
                
                if (!gas && !elc) errorExit("Tariff details must be provide for at least 1 of Gas or Electric");
                
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
        ctx.getAppDb().commit();
        ctx.setStatus(200);
    }
}
