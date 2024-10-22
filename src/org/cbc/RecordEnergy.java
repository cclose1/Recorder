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
import org.cbc.utils.system.Calendar;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public class RecordEnergy extends ApplicationServer {
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
    private boolean addReading(Context ctx, String type) throws SQLException, ParseException {
        SQLInsertBuilder sql       = ctx.getInsertBuilder("MeterReading");
        EnclosingRecords er        = new EnclosingRecords(ctx, "MeterReading");
        Date             timestamp = ctx.getTimestamp("Date", "Time");
        String           meter     = getMeter(ctx, timestamp, type);
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
        JSONObject data = new JSONObject();
        boolean commit = false;
        String readings;
        ResultSet rs;

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
            default:
                invalidAction();
                break;
        }
    }
}
