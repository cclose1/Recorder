/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.io.IOException;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Properties;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordReminder", urlPatterns = {"/RecordReminder"})
public class RecordReminder extends ApplicationServer { 

    private class Configuration {        
        Properties properties = new Properties();
        
        public void load(ServletConfig config, ApplicationServer.Configuration.Databases dbs) throws IOException {
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            dbs.setApplication(
                    properties.getProperty("remdatabase"), 
                    properties.getProperty("remuser"), 
                    properties.getProperty("rempassword"));
        }
    }
    Configuration config = new Configuration();
  
    @Override
    public String getVersion() {        
        return "V1.0 Released 01-Nov-19";    
    }
    @Override
    public void initApplication (ServletConfig config, ApplicationServer.Configuration.Databases databases) throws ServletException, IOException {
        this.config.load(config, databases);        
    }
    @Override
    public void processAction(
            Context ctx,
            String  action) throws ServletException, IOException, SQLException, JSONException, ParseException {
        
        switch (action) {
            case "getreminders":
                JSONObject data = reminder.getReminders(ctx.getParameter("filter"), ctx.getParameter("showall").equals("true"));
                data.append(ctx.getReplyBuffer(), "");
                ctx.setStatus(200);
                break;
            case "checkrefid":
                String refId = ctx.getParameter("refid");
                if (reminder.exists(refId)) {
                    ctx.getReplyBuffer().append("Change RefId as reminder already recorded for " + refId);
                }   ctx.setStatus(200);
                break;
            default:
                invalidAction();
                break;
        }
    }
}
