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
    private class Meter {
        private String identifier;
        private String type;
        private String deviceId;
        private Date   installed;
        private Date   removed;
        
        public Meter(DatabaseSession session, Date timestamp, String type) throws SQLException {
            String           ts  = session.getDateTimeString(timestamp);
            ResultSet        rs;
            SQLSelectBuilder sql = new SQLSelectBuilder("Meter", session.getProtocol());
            
            sql.addField("*");
            sql.addAnd("Type", "=", type);
            sql.addAnd("Installed", "<=", ts);
            sql.setWhere("AND ('" + ts + "' <= Removed OR Removed IS NULL)");
            rs = session.executeQuery(sql.build(), ResultSet.TYPE_SCROLL_SENSITIVE);
            
            if (rs.next()) {
                this.identifier = rs.getString("Identifier");
                this.type       = rs.getString("Type");
                this.deviceId   = rs.getString("DeviceId");
                this.installed  = rs.getTimestamp("Installed");                
                this.removed    = rs.getTimestamp("removed");
            }
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
        private Meter  meter;
        
        public MeterReading(Date timestamp, double reading, String type) {
            this.timestamp = timestamp;
            this.reading   = reading;
            this.type      = type;
        }
        public MeterReading(ResultSet rs) throws SQLException {
            this(rs.getTimestamp("Timestamp"), rs.getDouble("Reading"), rs.getString("Meter"));
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
    private SQLSelectBuilder getReadingsSQL(Context ctx, String readings) throws SQLException {
        SQLSelectBuilder sel;

        if (readings.equals("Meter")) {
            sel = ctx.getSelectBuilder(null);

            sel.addField("Timestamp");
            sel.addField("Weekday");
            sel.addField("Reading");
            sel.addField("Meter");
            sel.addField("Type");
            sel.addField("Estimated",  sel.setValue(""));
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
    /*
     * Returns the timestamp of the latest meter reading before or equal to timestamp for meter type.
     */
    private MeterReading getNearestMeterReading(Context ctx, Date timestamp, String type) throws SQLException, ParseException {
        ResultSet        rs;
        SQLSelectBuilder sql   = ctx.getSelectBuilder("MeterReading");
        Meter            meter = new Meter(ctx.getAppDb(), timestamp, type);
        
        sql.addField("Timestamp");
        sql.addField("Reading");
        sql.addField("Meter");
        sql.addAnd("Meter",     "=",  meter.getIdentifier());
        sql.addAnd("Timestamp", "<=", timestamp);
        sql.addAnd("Estimated", "<>", "Y");
        sql.addOrderByField("Timestamp", true);
        sql.setMaxRows(1);
        rs = executeQuery(ctx, sql);
       
        if (!rs.next()) return null;
        
        return new MeterReading(rs.getTimestamp("Timestamp"), rs.getDouble("Reading"), type);
    }
    private void deriveMeterReading(Context ctx) throws SQLException, ParseException, JSONException {            
        Date             timestamp     = ctx.getTimestamp("Timestamp");
        String           type          = ctx.getParameter("Type");
        double           toReading     = ctx.getDouble("Reading", -1);
        MeterReading     start         = getNearestMeterReading(ctx, timestamp, type);
        SQLSelectBuilder sql           = ctx.getSelectBuilder("SmartMeterUsageData");
        double           reading       = 0;
        int              increments    = 0;
        Date             lastIncrement = timestamp;
        boolean          complete      = false;
        JSONObject       data;
        ResultSet        rs;
        
        if (start == null) errorExit("CreateMeterReading for " + timestamp + " no prior meter reading");

        reading = start.getReading();
        sql.addField("*");
        sql.addAnd("Type",       "=", type);
        sql.addAnd("Timestamp", ">=", start.getTimestamp());
        
        rs = executeQuery(ctx, sql);
        
        while (rs.next()) {
            double increment = rs.getDouble("Reading");
            
            complete = true;
            
            if (toReading >  0 && reading + increment > toReading)               break;
            if (toReading <= 0 && rs.getTimestamp("Timestamp").after(timestamp)) break;
            
            increments++;
            complete      = false;
            reading      += increment;
            lastIncrement = rs.getTimestamp("Timestamp");
        }
        if (!complete) errorExit("CreateMeterReading for " + timestamp + " not possible");
        
        long hours = DateFormatter.dateDiff(start.getTimestamp(), lastIncrement, DateFormatter.TimeUnits.Hours);
        
        if (2 * hours - increments > 5) 
            errorExit( 
                    "CreateMeterReading for " + timestamp + " not possible. " +
                    " Time gap " + hours + 
                    " hours but only " + increments + " SmartMeterUsageData values available");
        data = new JSONObject();
        data.add("PriorTimestamp", ctx.getDbTimestamp(start.getTimestamp()));
        data.add("PriorReading",   Utils.round(start.getReading(), 3));
        data.add("Timestamp",      ctx.getDbTimestamp(lastIncrement));
        data.add("Reading",        Utils.round(reading, 3));
        data.add("Type",           type);
        data.append(ctx.getReplyBuffer(), "");
    }
    private boolean addReading(Context ctx, String type) throws SQLException, ParseException {
        SQLInsertBuilder sql       = ctx.getInsertBuilder("MeterReading");
        EnclosingRecords er        = new EnclosingRecords(ctx, "MeterReading");
        Date             timestamp = ctx.getTimestamp("Date", "Time");
        String           meter     = (new Meter(ctx.getAppDb(), timestamp, type)).getIdentifier();
        double           reading   = ctx.getDouble(type,       -2);
        String           estimated = ctx.getParameter("Estimated").equalsIgnoreCase("true") ? "Y" : "";
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
            estimated = "Y";
        }
        sql.addField("Timestamp", timestamp);
        sql.addField("Meter",     meter);
        sql.addField("Reading",   reading);
        sql.addField("Estimated", estimated);
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
            default:
                invalidAction();
                break;
        }
    }
}
