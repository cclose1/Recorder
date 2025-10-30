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
    private int getMinutes(Date timestamp) throws ParseException {
        DateFormatter fmt = new DateFormatter("HH:mm");
        String mins = fmt.format(timestamp);

        return Utils.toSeconds(mins) / 60;
    }

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
        long rem = time / 1000;

        int[] flds = {0, 0, 0, 0, 0};

        flds[4] = (int) (time - 1000 * rem);
        time = rem;
        rem = time / 60;
        flds[3] = (int) (time - 60 * rem);
        time = rem;
        rem = time / 60;
        flds[2] = (int) (time - 60 * rem);
        time = rem;
        rem = time / 24;
        flds[1] = (int) (time - 24 * rem);
        flds[0] = (int) rem;
        return flds;
    }

     public final int getElapsedDays(Date from, Date to) {
        return (int) (to.getTime() / 1000 / 60 / 60 / 24 - from.getTime() / 1000 / 60 / 60 / 24);
    }

    private class Meter {
        private String identifier;
        private String type;
        private String deviceId;
        private Date installed;
        private Date removed;

        private void load(ResultSet rs) throws SQLException {
            if (rs.next()) {
                this.identifier = rs.getString("Identifier");
                this.type = rs.getString("Type");
                this.deviceId = rs.getString("DeviceId");
                this.installed = rs.getTimestamp("Installed");
                this.removed = rs.getTimestamp("removed");
            }
        }

        public Meter() {
            this.identifier = "undefined";
        }

        public Meter(DatabaseSession session, Date timestamp, String type) throws SQLException {
            String ts = session.getDateTimeString(timestamp);
            ResultSet rs;
            SQLSelectBuilder sql = new SQLSelectBuilder("Meter", session.getProtocol());

            sql.addField("*");
            sql.addAnd("Type", "=", type);
            sql.addAnd("Installed", "<=", ts);
            sql.setWhere("AND ('" + ts + "' <= Removed OR Removed IS NULL)");
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            load(rs);
        }

        public Meter(DatabaseSession session, String identifier) throws SQLException {
            ResultSet rs;
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
        private Date timestamp;
        private double reading;
        private String type;
        private String meter;
        private String status;
        private String source;
        private String comment;

        private long secondsBetween(Date from, Date to) {
            return DateFormatter.dateDiff(from, to, DateFormatter.TimeUnits.Seconds);
        }

        public MeterReading(DatabaseSession session, Date timestamp, String meter) {
            this.session = session;
            this.timestamp = timestamp;
            this.meter = meter;
        }

        public MeterReading(
                DatabaseSession session,
                Date timestamp,
                String meter,
                double reading,
                String status,
                String source,
                String comment) {
            this(session, timestamp, meter);
            this.reading = reading;
            this.status = status;
            this.source = source;
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

        public boolean load() throws SQLException {
            SQLSelectBuilder sql = new SQLSelectBuilder("MeterReading", session.getProtocol());
            ResultSet rs;

            sql.addAnd("Meter", "=", this.meter);
            sql.addAnd("Timestamp", "=", this.timestamp);
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);

            if (!rs.next()) {
                return false;
            }

            this.reading = rs.getFloat("Reading");
            this.status = rs.getString("Status");
            this.source = rs.getString("Source");
            this.comment = rs.getString("Comment");

            return true;
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

        public void setTimestamp(Date timestamp) {
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
            double minReading = -1;
            double maxReading = -1;

            er.addField("Meter", getMeter(), true);
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
                    long seconds = secondsBetween(lower.getTimestamp("Timestamp"), upper.getTimestamp("Timestamp"));
                    long secOffset = secondsBetween(lower.getTimestamp("Timestamp"), getTimestamp());

                    setReading(minReading + (maxReading - minReading) * secOffset / seconds);
                    setSource("Estimated");
                }
            }
        }

        private void setKey(SQLBuilder sql) throws SQLException {
            sql.addAnd("timestamp", "=", timestamp);
            sql.addAnd("Meter", "=", meter);
        }

        private void addDataFields(SQLBuilder sql, boolean onlyReading) {
            sql.addField("Timestamp", timestamp);
            sql.addField("Meter", meter);
            sql.addField("Reading", reading);

            if (onlyReading) {
                return;
            }

            sql.addField("Status", status);
            sql.addField("Source", source);
            sql.addField("Comment", comment);
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
        private double                     stdCost = 0;
        private int                        days    = 0;
        private Date                       smStart = null;        
        private Date                       smEnd   = null;
        private long                       hours   = 0;
        private Tariff                     tf;
        private Tariff.OffPeak.Accumulator tac;
        
        public boolean testOp(Date timestamp) throws 
                ParseException {
            int mins = getMinutes(timestamp);

            return mins >= 60 * 22 + 30 || mins < 60 * 4 + 30;
        }
        /*
         * Writes the totals to the log if dac is not null.
         *
         * If fo is not open the log file is created and the column headers are written.
         *
         * The new data is written to dac after the log is written, which will be if the timestamp
         * date is not the same as the date of the last added value.
         *
         * A timestamp of null is used to indicate completion. In this case, the current data is written to
         * the log and the files is closed.
         */
        private void updateDayLog(
                FileOutput                 fo,
                Tariff.OffPeak.Accumulator dac,
                String                     type,
                Date                       timestamp,
                float                      reading) throws IOException, SQLException, ParseException {
            if (dac == null) return;
            
            if (!fo.isFileOpen()) {
                fo.addColumn("Day", 18);
                fo.addColumn("Total",     10);
                fo.addColumn("OpKwh",     8);
                fo.addColumn("PkKwh",     8);
                fo.addColumn("FOpKwh",    8);
                fo.addColumn("PkKwhCost", 10);
                fo.addColumn("OpKwhCost", 10);
                fo.openFile("RecEnergy\\DayCosts" + type + "!Date.log");
                fo.writeLine();
            }
            if (timestamp == null || dac.hasDateChanged(timestamp)) {
                fo.add(dac.getDate());
                fo.add(dac.getKwh(),    3);
                fo.add(dac.getOpKwh(),  3);
                fo.add(dac.getPkKwh(),  3);
                fo.add(dac.getFOpKwh(), 3);
                fo.add(dac.getPkCost(), 2);
                fo.add(dac.getOpCost(), 2);
                fo.writeLine();
                dac.reset();
                
                if (timestamp == null) {
                    fo.close();
                    return;
                }
            }
            dac.add(timestamp, reading);
        }
        public EnergyCost( 
                DatabaseSession session, 
                Date            from, 
                Date            to, 
                String          type, 
                String          vatMode, 
                boolean         logDay) throws SQLException, ParseException, IOException {
            Tariff.OffPeak             op;
            Tariff.OffPeak.Accumulator dac = null;
            ResultSet                  rs;
            FileOutput                 fo         = new FileOutput(",");
            boolean                    first      = true;
            Date                       smTime     = new Date();
            SQLSelectBuilder           sql        = new SQLSelectBuilder("SmartMeterUsageData", session.getProtocol());
            boolean                    logOpTimes = false; // This is for trouble shooting

            smStart = from;
            smEnd   = to;
            tf      = new Tariff(session, type);
            tf.setRemoveVat(vatMode.equalsIgnoreCase("Remove"));
            
            op  = tf.new OffPeak(new Date());
            tac = op.new Accumulator();
            
            if (logDay) dac = op.new Accumulator();
            
            sql.addField("*");
            sql.addAnd("Type",  "=",  type);
            sql.addAnd("Start", ">=", from);
            sql.addAnd("Start", "<",  to);

            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);

            while (rs.next()) {
                float  reading = rs.getFloat("Reading");
                
                smTime = rs.getTimestamp("Start");              
                
                if (first && !Utils.compare(smTime, "=", from)) throw new ErrorExit("Missing Smart Meter data before " + from);
                                              
                tf.load(smTime);
                
                if (first || tac.hasDateChanged(smTime)) {
                    stdCost += tf.getStandingCharge();
                } 
                first  = false;
                tac.add(smTime, reading);
                updateDayLog(fo, dac, type, smTime, reading);
                
                if (dac != null && op.isOffPeak(smTime) && logOpTimes) {
                    fo.add(getLocalDate(smTime, "dd-MMM-yy HH:mm"));
                    fo.add(reading, 3);
                    fo.writeLine(); 
                }   
            }
            if (DateFormatter.dateDiff(smTime, to, DateFormatter.TimeUnits.Minutes) > 30) throw new ErrorExit("Missing Smart Meter data after " + smTime);
            
            hours   = DateFormatter.dateDiff(smStart, smTime, DateFormatter.TimeUnits.Hours);
            days    = getElapsedDays(smStart, smTime);
            updateDayLog(fo, dac, type, null, 0);
        }
        public float getMeterChange() {
            return tac.getReadingChange();
        }
        public float getOpCost() {
            return tac.getOpCost();
        }
        public float getOpKwh() {
            return tac.getOpKwh();
        }
        public float getPeakCost() {
            return tac.getPkCost();
        }
        public float getPeakKwh() {
            return tac.getPkKwh();
        }
        public double getStdCost() {
            return stdCost;
        }
        public double getTotalCost(boolean addVat) {
            double total = getOpCost() + getPeakCost() + getStdCost();
            
            return addVat? tf.addVat(total) : total;
        }
        public int getDays() {
            return days;
        }

        public Date getSmStart() {
            return smStart;
        }
        public Date getSmEnd() {
            return smEnd;
        }
        public int getUsageCount() {
            return tac.getIncrements();
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
        LocalErrorExit exit = new LocalErrorExit("CreateMeterReading", "");
        Date           from;
        Date           to;
        double         toReading;
        String         type;
        double         offset;
        MeterReading   start;
        Meter          meter = new Meter();
        double         reading = 0;
        int            increments = 0;
        Date           lastIncrement = from;
        boolean        complete = false;
        String         error = "";
        FileOutput     fo;

        private void log(DatabaseSession session, Date timestamp, double derivedReading) throws SQLException, IOException {
            if (this.fo == null) return;
            
            MeterReading mr = new MeterReading(session, timestamp, meter.getIdentifier());

            if (!mr.load()) return;
            
            double diff = mr.getReading() - derivedReading;
            
            fo.add(mr.timestamp);
            fo.add(mr.getReading(), 3);
            fo.add(mr.getSource());
            fo.add(derivedReading, 3);
            fo.add(diff, 3);
            fo.writeLine();
        }
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
                Date timestamp,
                String type,
                String status) throws SQLException, ParseException {
            ResultSet rs;
            SQLSelectBuilder sql = new SQLSelectBuilder("MeterReading", session.getProtocol());

            meter = new Meter(session, timestamp, type);

            sql.addField("Timestamp");
            sql.addField("Reading");
            sql.addField("Meter");
            sql.addField("Status");
            sql.addField("Source");
            sql.addField("Comment");
            sql.addAnd("Meter", "=", meter.getIdentifier());
            sql.addAnd("Timestamp", "<=", timestamp);

            if (!status.equals("")) {
                sql.addAnd("Status", "=", status);
            }

            sql.addOrderByField("Timestamp", true);
            sql.setMaxRows(1);
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);

            if (!rs.next()) return null;

            return new MeterReading(session, rs);
        }
        public DeriveMeterReading(
                DatabaseSession session,
                String type,
                Date from,
                Date to,
                double targetReading,
                double offset,
                boolean useVerified,
                boolean logMeter) throws SQLException, ParseException, IOException {
            SQLSelectBuilder sql = new SQLSelectBuilder("SmartMeterUsageData", session.getProtocol());
            ResultSet rs;

            this.from      = from;
            this.to        = to;
            this.toReading = targetReading;
            this.type      = type;
            this.offset    = offset;
            this.reading   = offset;

            if (logMeter) {
                fo = new FileOutput(",");
                fo.addColumn("Meter Time", 18);
                fo.addColumn("Reading",    10);
                fo.addColumn("Source",     -9);
                fo.addColumn("Derived",    10);
                fo.addColumn("Difference", 10);
                fo.openFile("RecEnergy\\Der" + type + "!Date.log");
                fo.writeLine();
            }
            start = getNearestMeterReading(session, from, this.type, useVerified ? "Verified" : "");

            try {
                boolean up;

                if (start == null) error("No prior meter reading");

                meter   = new Meter(session, start.getMeter());
                reading = start.getReading();

                if (to != null) {
                    up = to.after(start.getTimestamp());
                } else {
                    up = toReading > reading;
                }
                log(session, start.getTimestamp(), reading);
                reading += offset;

                sql.addField("*");
                sql.addAnd("Type", "=", type);
                sql.addAnd("End",  up ? ">" : "<=", start.getTimestamp());
                sql.addOrderByField("End", !up);

                rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);

                while (rs.next()) {
                    double increment = rs.getDouble("Reading");
                    Date   usageTime = rs.getTimestamp("End");
                    
                    complete = true;

                    if (!meter.timeInMeter(usageTime)) {
                        error("Calculated time " + DateFormatter.format(usageTime, "dd-MMM-yyy HH:MM") + " beyond meter " + meter.getIdentifier());
                    }
                    if (up) {
                        if (toReading > 0 && reading + increment > toReading) break;
                        if (toReading <= 0 && usageTime.after(to)) break;
                        
                        reading += increment;
                    } else {
                        if (toReading > 0 && reading -increment < toReading) break;
                        
                        if (toReading <= 0 && usageTime.before(to)) break;
                        /*
                         * Defer application to after log to as the increment applies to text meter reading.
                         */
                    }
                    increments++;
                    complete = false;
                    /*
                     * In case of down start is already logged. This prevents a repeat of the meter reading log.
                     */
                    if (!usageTime.equals(start.getTimestamp())) log(session, usageTime, reading);
                    
                    if (!up) reading -= increment;
                    if (lastIncrement == null
                            || increment > 0
                            || getElapsedDays(lastIncrement, usageTime) == 1) {
                        lastIncrement = usageTime;
                    }
                }
                if (lastIncrement == null) error("No SmartMeterUsageData available");
                if (!complete)             error("Not enough SmartMeterUsageData available");
                
                long hours = DateFormatter.dateDiff(start.getTimestamp(), lastIncrement, DateFormatter.TimeUnits.Hours);

                if (!up) {
                    hours *= -1;
                }
                if (2 * hours - increments > 5) {
                    error("Time gap " + hours + " but only " + increments + " SmartMeterUsageData values available");
                }
                if (logMeter) fo.close();
            } catch (LocalErrorExit ex) {
                error = ex.getReason();
            }
        }

        public Date getPriorTimestamp() {
            return start == null ? null : start.getTimestamp();
        }

        public double getPriorReading() {
            return start == null ? 0 : start.getReading();
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
            sel.addField("Status", sel.setValue(""));
            sel.addField("Source", sel.setValue(""));
            sel.addField("Comment", sel.setFieldSource("MR.Comment"), sel.setValue(""));
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
        String action = ctx.getParameter("action");
        SQLUpdateBuilder sql = null;

        if (start) {
            return;
        }

        if (!(action.equals("deleteTableRow") && ctx.getParameter("table").equals("Tariff"))) {
            return;
        }

        sql = ctx.getUpdateBuilder(ctx.getParameter("table"));

        sql.addAnd("End", "=", ctx.getTimestamp("Start"));
        sql.addAnd("Code", "=", ctx.getParameter("Code"));
        sql.addAnd("Type", "=", ctx.getParameter("Type"));

        sql.addField("End");

        executeUpdate(ctx, sql);
    }

    private boolean addTariff(Context ctx, String type) throws ParseException, SQLException {
        SQLInsertBuilder sql = ctx.getInsertBuilder("Tariff");
        EnclosingRecords er = new EnclosingRecords(ctx.getAppDb(), "Tariff");
        Date start = ctx.getTimestamp("Date");
        double rate = ctx.getDouble(type + " UnitRate", -1);
        double standing = ctx.getDouble(type + " StandingCharge", -1);
        double offpeak = ctx.getDouble(type + " OffPeakRate", -1);
        ResultSet upper;
        ResultSet lower;

        if (rate < 0) {
            return false;
        }

        er.addField("Code", ctx.getParameter("Code"), true);
        er.addField("Type", type, true);
        er.addField("Start", start, false);

        upper = er.getAfter();

        if (upper != null) {
            throw new ErrorExit("Must be after latest tarriff record");
        }
        lower = er.getBefore();

        if (lower != null) {
            if (start.equals(lower.getDate("Start"))) {
                throw new ErrorExit("Tariff already exists for this date");
            }

            lower.updateDate("End", ctx.getSQLDate(start));
            lower.updateRow();
        }
        sql.addField("Start", start);
        sql.addField("Type", type);
        sql.addField("Code", ctx.getParameter("Code"));
        sql.addField("StandingCharge", standing);
        sql.addField("UnitRate", rate);

        if (offpeak < 0) {
            sql.addField("OffPeakRate");
            sql.addField("OffPeakStart");
            sql.addField("OffPeakEnd");
        } else {
            sql.addField("OffPeakRate", offpeak);
            sql.addField("OffPeakStart", ctx.getParameter(type + " " + "OffPeakStart"));
            sql.addField("OffPeakEnd", ctx.getParameter(type + " " + "OffPeakEnd"));
        }
        sql.addField("Comment", ctx.getParameter("Comment"));

        executeUpdate(ctx, sql);
        return true;
    }

    private void deriveMeterReading(Context ctx) throws SQLException, ParseException, JSONException, IOException {
        DeriveMeterReading dmr = new DeriveMeterReading(
                ctx.getAppDb(),
                ctx.getParameter("Type"),
                ctx.getTimestamp("From"),
                ctx.getTimestamp("To"),
                ctx.getDouble("ToReading", -1),
                ctx.getDouble("Offset", 0),
                ctx.getBoolean("UseVerified", false),
                ctx.getBoolean("Log", false));
        JSONObject data = new JSONObject();

        data.add("PriorTimestamp", ctx.getDbTimestamp(dmr.getPriorTimestamp()));
        data.add("PriorReading", dmr.getPriorReading(), 3);
        data.add("Timestamp", ctx.getDbTimestamp(dmr.getTimestamp()));
        data.add("Reading", dmr.getReading(), 3);
        data.add("Meter", dmr.getMeterId());
        data.add("Comment", dmr.getError());
        data.append(ctx.getReplyBuffer(), "");
    }
    private void calculateCosts(Context ctx) throws SQLException, ParseException, JSONException, IOException {
        EnergyCost ec = new EnergyCost(
                ctx.getAppDb(), 
                timeWithDate.toGMT(ctx.getTimestamp("Start")), 
                timeWithDate.toGMT(ctx.getTimestamp("End")), 
                ctx.getParameter("Type"),
                ctx.getParameter("VatMode"),
                ctx.getBoolean("LogDaily", false));
        JSONObject data = new JSONObject();

        data.add("MeterChange",    ec.getMeterChange(), 2);
        data.add("OffPeakCost",    ec.getOpCost() / 100, 2);
        data.add("OffPeakKwh",     ec.getOpKwh(), 2);
        data.add("PeakCost",       ec.getPeakCost() / 100, 2);
        data.add("PeakKwh",        ec.getPeakKwh(), 2);
        data.add("StandingCost",   ec.getStdCost() / 100, 2);
        data.add("StandingCharge", ec.getStandingCharge(), 2);
        data.add("UnitRate",       ec.getUnitRate(), 2);
        data.add("OffPeakRate",    ec.getOpRate(), 2);
        data.add("CalorificValue", ec.getCalorificValue(), 2);
        data.add("Days",           ec.getDays());        
        data.add("TotalCost",      ec.getTotalCost(false) / 100, 2);
        data.add("TotalWithVat",   ec.getTotalCost(true) / 100, 2);
        data.add("ValuesUsed",     ec.getUsageCount());
        data.append(ctx.getReplyBuffer(), "");
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
    private void getChartData(Context ctx) throws ParseException, SQLException, JSONException  {
        SQLSelectBuilder sql;
        Date       start     = ctx.getTimestamp("Start");  
        Date       end       = ctx.getTimestamp("End");
        String     table     = ctx.getParameter("Table");
        JSONObject data      = new JSONObject();
        String     group     = ctx.getParameter("GroupByN", "");
        boolean    isGroup   = !group.equals("");
        boolean    timeLocal = ctx.getBoolean("TimeLocal", false);
        ResultSet  rs;
        String[]   fields   = ctx.getParameter("Fields").split(",");
        
        sql = ctx.getSelectBuilder(table);
        
        if (timeLocal) {            
            start = timeWithDate.toGMT(start);
            end   = timeWithDate.toGMT(end);
        }
        sql.addAnd("!" + fields[0], ">=", start);
        sql.addAnd("!" + fields[0],  "<", end);            
        sql.addAnd(ctx.getParameter("filter"));
        sql.addOrderByField(fields[0], false);
        
        if (isGroup) {
            String[] grflds = group.split(",");
            
            for (String grfld : grflds) {
                sql.addGroupByField(grfld);
            }
        }
        for (int fld = 0; fld < fields.length; fld++) {
            String[] attributes = fields[fld].split(":");
            String name  = "";
            String alias = "";
            String aggr  = isGroup? fld == 0? "Min" : "Sum" : "";
            
            switch (attributes.length) {
                case 1:
                    name  = attributes[0];
                    alias = name;                    
                    break;
                case 2:
                    name  = attributes[0];
                    alias = attributes[1];                    
                    break;
                case 3:
                    name  = attributes[0];
                    alias = attributes[1];
                    aggr  = attributes[2];     
                    
                    if (isGroup) errorExit("Field " + name + " Aggregate requires group by");
                    break;
                default:
                    errorExit("Fields-" + ctx.getParameter("Fields") + "-incorrectly formatted");
            }
            if (!aggr.equals("")) name = aggr + "(" + name + ")"; 
            
            sql.addField(alias, name);
        }
        rs = ctx.getAppDb().executeQuery(sql.build());
        data.add("ChartData", rs, timeLocal);
        data.append(ctx.getReplyBuffer());
    }
    private void getSMData(Context ctx) throws SQLException, ParseException, JSONException, IOException {
        String           type      = ctx.getParameter("Type");
        SQLSelectBuilder sql;
        Date             start     = ctx.getTimestamp("Start");  
        Date             end       = ctx.getTimestamp("End");
        String           table;
        JSONObject       data      = new JSONObject();
        String           group     = ctx.getParameter("GroupBy", "");
        boolean          timeLocal = group.equals("") || group.equalsIgnoreCase("hour");
        ResultSet        rs;
        
        switch (type) {
            case "Solar":
                table = "SolarReadings";
                break;
            case "SolarExport":
                table = "SolarExportData";
                break;
            default:
                table = "SmartMeterUsageKwh"; 
                break;
        }
        sql = ctx.getSelectBuilder(table);
        
        if (timeLocal) {            
            start = timeWithDate.toGMT(start);
            end   = timeWithDate.toGMT(end);
        }
        sql.addAnd("!Start", ">=", start);
        sql.addAnd("!Start",  "<", end);
        sql.addOrderByField("Start", false);
        
        if (type.equals("SolarExport")) {
                sql.addField("Start");
                sql.addField("KwhPerDay");
                sql.addField("KwhExportedPerDay");
                sql.addField("%Exported");
        } else {
            if (group.length() == 0) {
                sql.addField("Start");
                sql.addField("Kwh");
            } else {
                sql.addField("Start", "Min(Start)");
                sql.addField("Kwh", "Sum(Kwh)");
            }
            sql.addAnd(ctx.getParameter("filter"));

            if (group.length() != 0) {
                sql.addGroupByField("Year");

                if (group.equalsIgnoreCase("hour")) {
                    sql.addGroupByField("Day");
                }
                sql.addGroupByField(group);
            }
        }
        rs = ctx.getAppDb().executeQuery(sql.build());
        data.add("SMData", rs, timeLocal);
        data.append(ctx.getReplyBuffer());
    }
    private boolean addReading(Context ctx, String type) throws SQLException, ParseException {
        String meterId    = (new Meter(ctx.getAppDb(), ctx.getTimestamp("Timestamp"), type)).getIdentifier();
        String timeOffset = ctx.getParameter("TimeOffset");
        Date timestamp    = ctx.getTimestamp("Timestamp");

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

        if (meterReading.getReading() <= -2) {
            return false;
        }
        meterReading.validate();
        meterReading.create();
        return true;
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
        
        switch (action) {
            case "Create":
                if (addReading(ctx, "Gas")) {
                    commit = true;
                }
                if (addReading(ctx, "Electric")) {
                    commit = true;
                }
                if (addReading(ctx, "Export")) {
                    commit = true;
                }
                if (addReading(ctx, "Solar")) {
                    commit = true;
                }
                if (!commit) {
                    throw new ErrorExit("At least 1 reading is required");
                }

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
                reading.create();
                ;
                break;
            case "readingshistory":
                readings = ctx.getParameter("readings");
                sel = getReadingsSQL(ctx, readings);
                rs = executeQuery(ctx, sel);
                data.add(readings, rs);
                data.append(ctx.getReplyBuffer());
                break;
            case "calvals":
                sel = ctx.getSelectBuilder("CalorificValue");

                sel.addField("Date");
                sel.addField("Value");
                sel.addField("Comment");
                sel.addOrderByField("Date", true);

                rs = executeQuery(ctx, sel);
                data.add("CalVals", rs);

                data.append(ctx.getReplyBuffer());
                break;
            case "pkover":
                sel = ctx.getSelectBuilder("PeakTariffOverride");

                sel.addField("Start");
                sel.addField("End");
                sel.addField("Status");
                sel.addField("Comment");
                sel.addOrderByField("Start", true);
                sel.addAnd("Type", "=", "Electric");

                rs = executeQuery(ctx, sel);
                data.add("CalVals", rs);

                data.append(ctx.getReplyBuffer());
                break;
            case "tariffs":
                sel = getTariffsSQL(ctx);
                rs = executeQuery(ctx, sel);
                data.add("tariffs", rs);
                data.append(ctx.getReplyBuffer());
                break;
            case "CreateTariff":
                ctx.getAppDb().startTransaction();

                boolean gas = addTariff(ctx, "Gas");
                boolean elc = addTariff(ctx, "Electric");

                if (!gas && !elc) {
                    errorExit("Tariff details must be provide for at least 1 of Gas or Electric");
                }

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
            case "getSMData":
                if (ctx.existsParameter("Fields"))
                    getChartData(ctx);
                else
                    getSMData(ctx);
                break;
            default:
                invalidAction();
                break;
        }
        ctx.getAppDb().commit();
        ctx.setStatus(200);
    }
}
