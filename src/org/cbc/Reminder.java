/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Date;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLBuilder;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;

/**
 *
 * @author chris
 */
public class Reminder {
    private DatabaseSession db;
    private int             alertFrequency = 10;
    private int             immediateDays  = 1;
    private Date            lastAlert      = null;
    
    public class State {
        private int  active    = 0;
        private int  immediate = 0;
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
    }
    private String setFilter(String filter) {
        if (filter.length() != 0) filter += " AND ";
        
        if (db.getProtocol().equalsIgnoreCase("sqlserver"))
            filter += "CURRENT_TIMESTAMP BETWEEN DATEADD(DAY,-COALESCE(Warndays, 5), Timestamp) AND Timestamp";
        else
            filter += "CURRENT_TIMESTAMP BETWEEN DATE_ADD(Timestamp, INTERVAL -COALESCE(Warndays, 5) DAY) AND Timestamp";
        
        return filter;
    }
    public Reminder(DatabaseSession session) {
        db = session;
    }
    public void changeDatabase(DatabaseSession session) {
        db = session;
    }
    public State alert() throws SQLException {
        Date  now   = new Date();
        State state = new State();
        
        int  min = lastAlert == null? alertFrequency : (int)((now.getTime() - lastAlert.getTime()) / 60000);
        
        if (min <= alertFrequency && lastAlert != null) return state;
        
        lastAlert       = now;
        state.lastCheck = now;
        SQLSelectBuilder sql = new SQLSelectBuilder("ReminderState");
        
        sql.addField("Count",     sql.setFieldSource("Count(*)"));
        sql.addField("Immediate", sql.setFieldSource("COUNT(CASE WHEN Remaining <= " + immediateDays + " THEN 1 ELSE NULL END)"));
        
        sql.addAnd("Alert", "=", "Y");       
        
        ResultSet rs = db.executeQuery(sql.build());
        
        if (rs.next()) {
            state.active    = rs.getInt("Count");
            state.immediate = rs.getInt("Immediate");
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
        sql.addField("SeqNo");
        sql.addField("Timestamp");
        sql.addField("Type");
        sql.addField("Frequency");
        sql.addField("WarnDays");
        sql.addField("Suspended");
        sql.addField("Description");
        sql.setOrderBy("Timestamp DESC");
        
        filter = setFilter(filter);
        
        if (!showall && filter.length() != 0) {
            sql.addAndClause(filter);
            sql.addAnd("Suspended", "<>", "Y");            
        }        
        ResultSet rs = db.executeQuery(sql.build());
        data.add("Reminders", rs);
        
        return data;
    }
    public boolean exists(Date timestamp) throws SQLException {
        
        SQLSelectBuilder  sql = new SQLSelectBuilder("Reminder");
        
        sql.addField("Timestamp");
        sql.addAnd("Timestamp", "=", timestamp);
            
        ResultSet rs = db.executeQuery(sql.build());
        
        return rs.next();
    }
    public void update(String seqNo, Date timestamp, String type, String frequency, String warnDays, String suspended, String description) throws SQLException {
        SQLBuilder sql;
        
        if (seqNo == null || seqNo.length() == 0) {
            sql = new SQLInsertBuilder("Reminder");
        } else {
            sql = new SQLUpdateBuilder("Reminder");
            
            sql.addAnd("SeqNo", "=", seqNo, false);
        }
        sql.addField("Timestamp",   timestamp);
        sql.addField("Type",        type);
        sql.addField("Frequency",   frequency);
        sql.addField("WarnDays",    warnDays.length() == 0? null : warnDays, false);
        sql.addField("Suspended",   suspended);
        sql.addField("Description", description);
        
        db.executeUpdate(sql.build());
    }
}
