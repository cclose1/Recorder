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
            sel = ctx.getSelectBuilder("MeterReading");

            sel.addField("Timestamp");
            sel.addField("Weekday");
            sel.addField("Reading");
            sel.addField("Type");
            sel.addField("Estimated", sel.setValue(""));
            sel.setOrderBy("Timestamp DESC, Type");
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
            sel.setOrderBy("Start DESC, Type");
        }
        sel.setMaxRows(config.getIntProperty("spendhistoryrows", 100));
        sel.addField("Comment", sel.setValue(""));
        sel.addAnd(ctx.getParameter("filter"));

        return sel;
    }
    private SQLSelectBuilder getTariffsSQL(Context ctx) throws SQLException {
        SQLSelectBuilder sel = ctx.getSelectBuilder("Tariff");

        sel.addField("Tariff", "Code");
        sel.addField("Start");
        sel.addField("End");
        sel.addField("Type");
        sel.addField("UnitRate");
        sel.addField("StandingCharge");
        sel.addField("CalorificValue");
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
    protected void getList(Context ctx) throws SQLException, ParseException, JSONException {
        super.getList(ctx);
    }
    private boolean addTariff(Context ctx, String type) throws ParseException, SQLException {
        SQLInsertBuilder sql      = ctx.getInsertBuilder("Tariff");
        EnclosingRecords er       = new EnclosingRecords(ctx, "Tariff");
        Date             start    = ctx.getTimestamp("Date");
        double           rate     = ctx.getDouble(type + " UnitRate",       -1);
        double           standing = ctx.getDouble(type + " StandingCharge", -1);
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
        sql.addField("UnitRate",       rate);
        sql.addField("StandingCharge", standing);
        sql.addField("Comment",        ctx.getParameter("Comment"));
        
        if (type.equalsIgnoreCase("gas")) sql.addField("CalorificValue", ctx.getParameter("CalorificValue"));
        
        executeUpdate(ctx, sql);
        return true;
    }
    private boolean addReading(Context ctx, String type) throws SQLException, ParseException {
        SQLInsertBuilder sql       = ctx.getInsertBuilder("MeterReading");
        EnclosingRecords er        = new EnclosingRecords(ctx, "MeterReading");
        Date             timestamp = ctx.getTimestamp("Date", "Time");
        double           reading   = ctx.getDouble(type,       -2);
        String           estimated = ctx.getParameter("Etimated").equalsIgnoreCase("true") ? "Y" : "";
        ResultSet        upper;
        ResultSet        lower;
        double           minReading = -1;
        double           maxReading = -1;
        
        if (reading <= -2) return false;

        er.addField("Code",      ctx.getParameter("Code"), true);
        er.addField("Type",      type,                     true);
        er.addField("Timestamp", timestamp,                false);
        
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
        sql.addField("Type",      type);
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
                if (addReading(ctx, "Solar"))    commit = true;
                
                if (!commit) throw new ErrorExit("At least 1 reading is required");
                
                ctx.getAppDb().commit();
                ctx.setStatus(200);
                break;
            case "Delete":
                del = ctx.getDeleteBuilder("MeterReading");
                del.addAnd("Timestamp", "=", ctx.getTimestamp("Date", "Time"));
                del.addAnd("Type",      "=", ctx.getParameter("Type"));
                executeUpdate(ctx, del.build());
                ctx.getAppDb().commit();
                ctx.setStatus(200);
                break;
            case "readingshistory":
                readings = ctx.getParameter("readings");
                sel      = getReadingsSQL(ctx, readings);;
                rs       = executeQuery(ctx, sel);
                data.add("history", rs);
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
            case "getList":
                getList(ctx);
                break;
            default:
                ctx.dumpRequest("Action " + action + " is invalid");
                ctx.getReplyBuffer().append("Action ").append(action).append(" is invalid");
                break;
        }
    }
}
