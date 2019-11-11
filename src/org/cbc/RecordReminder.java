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
import java.util.Properties;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.application.reporting.Report;
import org.cbc.application.reporting.Trace;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.utils.system.Calendar;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordReminder", urlPatterns = {"/RecordReminder"})
public class RecordReminder extends ApplicationServer { 

    private class Configuration {        
        Properties properties = new Properties();
  /*
        private int getIntProperty(String name, int defaultValue) {
            String value = properties.getProperty(name);
            
            if (value == null) return defaultValue;
            
            try {
                return Integer.parseInt(value);
            } catch (NumberFormatException ex) {
                Report.error(null, "Property " + name + " value=" + value + " is not an integer defaulting to " + defaultValue);
            }        
            return defaultValue;
        }
        */
        public void load(ServletConfig config, ApplicationServer.Configuration.Databases dbs) throws IOException {
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            dbs.setApplication(
                    properties.getProperty("remdatabase"), 
                    properties.getProperty("remuser"), 
                    properties.getProperty("rempassword"));
        }
    }
    Configuration config = new Configuration();
    /*
     * Copies the monthly fields for year and month in Date which defaults to todays date if null.
     * If there are already monthly fields for year and month no action is taken as they have already been copied.
     *
     * The monthly fields from the previous month are copied adding 1 to the month of the timestamp field.
     *
     * This could be done using a single insert select statement. However, adding a month to a DATETIME field differs
     * for each database. The code in this routine should work for all databases.
     */
    public String getVersion() {        
        return "V1.0 Released 01-Nov-19";    
    }
    public void initApplication (ServletConfig config, ApplicationServer.Configuration.Databases databases) throws ServletException, IOException {
        this.config.load(config, databases);        
    }
    public void processAction(
            Context ctx,
            String  action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        
        if (action.equals("deletereminder")) {
            SQLDeleteBuilder sql = ctx.getDeleteBuilder("Reminder");
            
            sql.addAnd("RefId", "=", ctx.getParameter("refid"));
            executeUpdate(ctx, sql.build());
            ctx.setStatus(200);
        } else if (action.equals("createreminder")) {           
            Date date  = ctx.getTimestamp("date", "time");
            
            reminder.create(
                    ctx.getParameter("refid"), 
                    date, 
                    ctx.getParameter("type"), 
                    ctx.getParameter("frequency"), 
                    ctx.getParameter("warndays"), 
                    ctx.getParameter("suspended"), 
                    ctx.getParameter("description"), 
                    ctx.getParameter("comment"));
            ctx.setStatus(200);
            ctx.getAppDb().commit();
        } else if (action.equals("savereminder")) {           
            Date date  = ctx.getTimestamp("date", "time");
            
            reminder.update(
                    ctx.getParameter("refid"), 
                    date, 
                    ctx.getParameter("type"), 
                    ctx.getParameter("frequency"), 
                    ctx.getParameter("warndays"), 
                    ctx.getParameter("suspended"), 
                    ctx.getParameter("description"), 
                    ctx.getParameter("comment"));
            ctx.setStatus(200);
            ctx.getAppDb().commit();
        } else if (action.equals("getreminders")) { 
            JSONObject data = reminder.getReminders(ctx.getParameter("filter"), ctx.getParameter("showall").equals("true"));
            
            data.append(ctx.getReplyBuffer(), "");
            ctx.setStatus(200);
        } else if (action.equals("checkrefid")) {
            String refId = ctx.getParameter("refid");
            
            if (reminder.exists(refId)) {                
                ctx.getReplyBuffer().append("Change RefId as reminder already recorded for " + refId);
            }
            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid");
        }
    }
}
