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

    private class ValidateCreate {
        public Date    timestamp;
        public String  type;
        public double  reading;
        public String  error = "";
        public String  estimated;
        public Context ctx;
        
        private void setError(String message) {
            if (reading != -1)
                error = "Reading for " + type + " is " + reading + " " + message;
            else
                error = message;
            
            throw new ErrorExit(error);
        }
        private void validate(String type) throws ParseException, SQLException {
            SQLSelectBuilder sel = ctx.getSelectBuilder("BoundedReading");
            ResultSet        rs;
            double           startReading;
            double           endReading;
            int              days;

            this.timestamp = ctx.getTimestamp("date", "time");
            this.type      = type;
            this.reading   = ctx.getDouble(type, -2);
            this.estimated = ctx.getParameter("estimated").equalsIgnoreCase("true") ? "Y" : "";

            if (this.reading == -2) return;
            
            sel.addField("Start");
            sel.addField("Type");
            sel.addField("StartReading");
            sel.addField("EndReading");
            sel.addField("Days");
            sel.addAnd("Type", "=", type);
            sel.addAndStart(timestamp);

            rs = executeQuery(ctx, sel);

            if (rs.next()) {
                /*
                 * Check if new reading can be created in between the 2 that span it. If the new reading is negative a
                 * value is estimated based on were it lies between the 2, otherwise the new value has to be
                 * between startReading and endReading,
                 */
                startReading = rs.getDouble("StartReading");
                endReading   = rs.getDouble("EndReading");
                days         = rs.getInt("Days");

                if (reading < 0) {
                    int dayOffset = Calendar.daysBetween(rs.getDate("Start"), timestamp);

                    reading   = startReading + (endReading - startReading) * dayOffset / days;
                    estimated = "Y";
                } else {
                    if (reading < startReading || reading > endReading) {
                        setError("but must be between " + startReading + " and " + endReading);
                    }
                }
            } else if (reading != -1) {
                /*
                 * Reading must be greater that the latest for type.
                 */

                sel = ctx.getSelectBuilder("MeterReading");
                sel.addField("Reading", "Max(Reading)");
                sel.addAnd("Type", "=", type);
               
                rs = executeQuery(ctx, sel);

                if (rs.next()) {
                    if (reading < rs.getDouble("Reading")) {
                        setError("but must be greater than " + rs.getDouble("Reading"));
                    }
                }
            } else
                setError("Estimates not supported after latest reading");
        }
        public ValidateCreate(Context ctx) throws ParseException, SQLException {
            this.ctx = ctx;
        }
        public void setType(String type) throws ParseException, SQLException {
            validate(type);
        }
    }
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
        sel.addField("Comment",   sel.setValue(""));
        sel.addAnd(ctx.getParameter("filter"));
        
        return sel;
    }
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
    private boolean addReading(ValidateCreate create, String type) throws SQLException, ParseException {
        SQLInsertBuilder sql = create.ctx.getInsertBuilder("MeterReading");

        create.setType(type);
        
        if (create.reading <= -2) {
            return false;
        }
        sql.addField("Timestamp", create.timestamp);
        sql.addField("Type",      type);
        sql.addField("Reading",   create.reading);
        sql.addField("Estimated", create.estimated);
        sql.addField("Comment",   create.ctx.getParameter("comment"));
        executeUpdate(create.ctx, sql);
        
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
                ValidateCreate create = new ValidateCreate(ctx);

                if (addReading(create, "Gas"))      commit = true;
                if (addReading(create, "Electric")) commit = true;
                if (addReading(create, "Solar"))    commit = true;
                
                if (!commit) throw new ErrorExit("At least 1 reading is required");
                
                ctx.getAppDb().commit();
                ctx.setStatus(200);
                break;
            case "Delete":
                del = ctx.getDeleteBuilder("MeterReading");
                del.addAnd("Timestamp", "=", ctx.getTimestamp("ddate", "dtime"));
                del.addAnd("Type",      "=", ctx.getParameter("dtype"));
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
            case "getList":
                getList(ctx);
                break;
            default:
                ctx.dumpRequest("Action " + action + " is invalid");
                ctx.getReplyBuffer().append("Action " + action + " is invalid");
                break;
        }
    }
}
