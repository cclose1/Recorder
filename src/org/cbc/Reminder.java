/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Date; 
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;
/**
 *
 * @author chris
 */
public class Reminder {
    private static final int MSINDAY            = 24*60*60*1000;
    private static final int MSINMINUTE         = 60*1000;
    private DatabaseSession  db;
    private int              alertFrequency      = 10;
    private int              immediateDays       = 1;
    private Date             lastAlert           = null;
    private Date             lastFrequencyUpdate = new Date((new Date()).getTime() - MSINDAY);
    
    public class State {
        private int  active    = 0;
        private int  immediate = 0;        
        private Date earliest  = null;

        private Date lastCheck = lastAlert;
        
        public boolean alerts() {
            return active > 0;
        }
        public int getActive() {
            return active;
        }
        public int getImmediate() {
            return immediate;
        }
        public Date getLastCheck() {
            return lastCheck;
        }
        public int getAlertFrequency() {
            return alertFrequency;
        }
        public Date getEarliest() {
            return earliest;
        }
    }
    private String getActiveFilter(String filter) {
        if (filter.length() != 0) filter += " AND ";
        
        if (db.getProtocol().equalsIgnoreCase("sqlserver"))
            filter += "CURRENT_TIMESTAMP BETWEEN DATEADD(DAY,-COALESCE(Warndays, 5), Timestamp) AND Timestamp";
        else
            filter += "CURRENT_TIMESTAMP BETWEEN DATE_ADD(Timestamp, INTERVAL -COALESCE(Warndays, 5) DAY) AND Timestamp";
        
        filter += " AND Suspended <> 'Y'";
        
        return filter;
    }
    public Reminder(DatabaseSession session) {
        db = session;
    }
    public void changeDatabase(DatabaseSession session) {
        db = session;
    }
    public void updatebyFrequency(boolean force) throws SQLException {
        SQLUpdateBuilder sql = new SQLUpdateBuilder("Reminder");
        /*
         * Return if not force and last update was less than a day ago; 
         */
        if (!force && (new Date()).getTime() - lastFrequencyUpdate.getTime() < MSINDAY) return;
        
        sql.addField(
                "Timestamp", 
                db.getProtocol().equals("sqlserver")? 
                        "CASE WHEN Frequency = 'Y' THEN DATEADD(yy, 1, Timestamp) WHEN Frequency = 'M' THEN  DATEADD(mm, 1, Timestamp) END" :
                        "CASE WHEN Frequency = 'Y' THEN TIMESTAMPADD(year, 1, Timestamp) WHEN Frequency = 'M' THEN  TIMESTAMPADD(month, 1, Timestamp) END",
                false);
        sql.addAnd("Frequency = 'Y'|'M'", ',', '=', '|');
        sql.addAndClause("Timestamp < CURRENT_TIMESTAMP");
        db.executeUpdate(sql.build());
        lastFrequencyUpdate = new Date();
    }
    public State alert() throws SQLException, ParseException {
        Date  now   = new Date();
        State state = new State();
        
        
        int  min = lastAlert == null? alertFrequency : (int)((now.getTime() - lastAlert.getTime()) / MSINMINUTE);
        
        updatebyFrequency(false);
        
        if (min <= alertFrequency && lastAlert != null) return state;
        
        lastAlert       = now;
        state.lastCheck = now;
        SQLSelectBuilder sql = new SQLSelectBuilder("ReminderState");
        
        sql.addField("Count",     sql.setFieldSource("Count(*)"));
        sql.addField("Earliest",  sql.setFieldSource("MIN(Timestamp)"));
        sql.addField("Immediate", sql.setFieldSource("COUNT(CASE WHEN Remaining <= " + immediateDays + " THEN 1 ELSE NULL END)"));
        
        sql.addAnd("Alert", "=", "Y");       
        
        ResultSet rs = db.executeQuery(sql.build());
        
        if (rs.next()) {
            state.active    = rs.getInt("Count");
            state.immediate = rs.getInt("Immediate");
            
            if (state.active != 0) state.earliest  = DateFormatter.parseDate(rs.getDate("Earliest") + " " + rs.getTime("Earliest"));
        }
        return  state;
    }
    public void setAlertOptions(int alertFrequency, int immediateDays) {
        this.alertFrequency = alertFrequency;
        this.immediateDays  = immediateDays;
    }
    public JSONObject getReminders(String filter, boolean showall) throws SQLException, JSONException {
        JSONObject       data = new JSONObject();
        SQLSelectBuilder  sql = new SQLSelectBuilder("Reminder");
        
        sql.setProtocol(db.getProtocol());
        sql.addField("RefId");
        sql.addField("Timestamp"); 

        if (sql.getProtocol().equalsIgnoreCase("sqlserver")) {
            sql.addField("Weekday", sql.setExpressionSource("SUBSTRING(DATENAME(WEEKDAY, Timestamp), 1, 3)"));
        } else {
            sql.addField("Weekday", sql.setExpressionSource("SubStr(DayName(Timestamp), 1, 3)"));
        }
        sql.addField("Type");
        sql.addField("Frequency");
        sql.addField("WarnDays");
        sql.addField("Suspended");
        sql.addField("Description");
        sql.addField("Comment");
        sql.setOrderBy("Timestamp DESC");
        sql.addAnd(filter);
        
        if (!showall) sql.addAndClause(getActiveFilter(""));    
        
        ResultSet rs = db.executeQuery(sql.build());
        data.add("Reminders", rs);
        
        return data;
    }
    public boolean exists(String refid) throws SQLException {
        
        SQLSelectBuilder  sql = new SQLSelectBuilder("Reminder");
        
        sql.addField("Timestamp");
        sql.addAnd("RefId", "=", refid);
            
        ResultSet rs = db.executeQuery(sql.build());
        
        return rs.next();
    }
    
    public void create(String refId, Date timestamp, String type, String frequency, String warnDays, String suspended, String description, String comment) throws SQLException {
        SQLInsertBuilder sql = new SQLInsertBuilder("Reminder");
        
        sql.addField("RefId",       refId);
        sql.addField("Timestamp",   timestamp);
        sql.addField("Type",        type);
        sql.addField("Frequency",   frequency);
        sql.addField("WarnDays",    warnDays.length() == 0? null : warnDays, false);
        sql.addField("Suspended",   suspended);
        sql.addField("Description", description);
        sql.addField("Comment",     comment);
        
        db.executeUpdate(sql.build());
    }

    public void update(String refId, Date timestamp, String type, String frequency, String warnDays, String suspended, String description, String comment) throws SQLException {
        SQLUpdateBuilder sql = new SQLUpdateBuilder("Reminder");
        
        sql.addField("Timestamp",   timestamp);
        sql.addField("Type",        type);
        sql.addField("Frequency",   frequency);
        sql.addField("WarnDays",    warnDays.length() == 0? null : warnDays, false);
        sql.addField("Suspended",   suspended);
        sql.addField("Description", description);
        sql.addField("Comment",     comment);
        
        sql.addAnd("RefId", "=", refId);
        
        db.executeUpdate(sql.build());
    }
}
