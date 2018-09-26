/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.ParseException;
import java.util.Date;
import javax.servlet.http.HttpServletRequest;
import org.cbc.application.reporting.Report;
import org.cbc.application.reporting.Trace;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;
import org.cbc.utils.system.SecurityConfiguration;
import org.cbc.utils.system.SecurityHash;

/**
 *
 * @author Chris
 */
class Security {
    private boolean               loggedIn        = false;
    private boolean               securityFailure = false;
    private String                sessionId       = "";
    private StringBuilder         reply           = new StringBuilder();
    private DatabaseSession       db;
    private HttpServletRequest    request;
    private String                host            = null;
    private String                protocol        = null;
    private String                origin          = null;
    private String                referrer        = null;
    private DateFormatter         df              = new DateFormatter("yyyy-MM-dd HH:mm:ss");
    private HTTPRequestHandler    handler;
    private SecurityConfiguration config;
    
    public Security(DatabaseSession db, HttpServletRequest request, SecurityConfiguration configuration) {
        Trace t = new Trace("Security");
        
        handler      = new HTTPRequestHandler(request);
        config       = configuration;
        this.db      = db;
        this.request = request;
        sessionId    = handler.getCookie("sessionid");
        host         = request.getServerName();
        protocol     = request.getProtocol();
        origin       = request.getHeader("origin");
        referrer     = request.getHeader("referer");
        t.exit();
    }

    private String getUserTable() {
        return db.getProtocol().equals("mysql") ? "Expenditure.User" : "\"User\"";
    }

    public void checkSession(int deadlocks) throws SQLException, ParseException {
        Trace t = new Trace("checkSession");
        
        SQLSelectBuilder sql;
        boolean          logInRequired = config.getLoginRequired() || config.getSSHRequired();
        String           source        = origin == null ? referrer : origin;
        
        if (config.getLogRequest()) {
            handler.dumpRequest();
        }
        if (!source.startsWith("https://") && config.getSSHRequired()) {
            reply.append("securityfailure;httpsrequired;");
            securityFailure = true;
        }
        if (!loggedIn && !sessionId.isEmpty() && reply.length() == 0 && logInRequired) {
            Trace r = new Trace("checkSession Read session data", 'L');
            db.startTransaction(db.getConnection().TRANSACTION_SERIALIZABLE);
            sql = new SQLSelectBuilder();
            sql.addField("S.SeqNo");
            sql.addField("S.SessionId");
            sql.addField("S.UserId");
            sql.addField("S.Last");
            sql.addField("S.Accesses");
            sql.addField("S.Deadlocks");
            sql.addField("U.MaxIdleTime");
            sql.setFrom("Session S " + "JOIN " + getUserTable() + " U " + "ON  S.UserId = U.UserId");
            sql.setWhere("SessionId = '" + sessionId + "' AND   S.State = 'Active'");
            ResultSet rs = db.updateQuery(sql.build());
            r.exit();
            if (rs.next()) {
                int count = rs.getInt("Accesses");
                long maxIdle = 60000 * rs.getInt("MaxIdleTime");
                Date last = getDate(rs, "Last");
                deadlocks += rs.getInt("Deadlocks");
                t.report('C', "Deadlocks read");
                
                if (maxIdle != 0 && last != null && new Date().getTime() - last.getTime() > maxIdle) {
                    logOff("Timed Out");
                    reply.append("securityfailure;Session Timed Out");
                    securityFailure = true;
                } else {
                    Trace s = new Trace("checkSession Update", 'L');
                    sql = new SQLSelectBuilder("Session");
                    sql.setParameter("SessionId", sessionId);
                    sql.addField("SeqNo");
                    sql.addField("SessionId");
                    sql.addField("Last");
                    sql.addField("Accesses");
                    sql.addField("Deadlocks");
                    sql.setWhere("SessionId = ?SessionId AND State = 'Active'");
                    PreparedStatement pst = db.prepareStatement(sql.resolve(true), ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_UPDATABLE);
                    sql.setParameters(pst);
                    rs = pst.executeQuery();
                    if (rs.next()) {
                        rs.moveToCurrentRow();
                        rs.updateTimestamp("Last", new java.sql.Timestamp((new Date()).getTime()));
                        rs.updateInt("Accesses", count + 1);
                        rs.updateInt("Deadlocks", deadlocks);
                        rs.updateRow();
                    }
                    s.exit();
                    loggedIn = true;
                }
            }
            db.commit();
        }
        if (!securityFailure && !loggedIn && logInRequired) {
            securityFailure = true;
            reply.append("securityfailure;notloggedin;");
        }
        if (reply.length() != 0) {
            Report.comment(null, reply.toString());
        }
        t.exit();
    }

    private Date getDate(ResultSet rs, String name) throws SQLException {
        java.sql.Timestamp date = rs.getTimestamp(name);
        if (date == null) {
            return null;
        }
        return new Date(date.getTime());
    }

    private void updateUser(SQLUpdateBuilder sql) throws SQLException {
        db.executeUpdate(sql.build());
        sql.clearFields();
    }

    public void login() throws SQLException, NoSuchAlgorithmException {
        String user          = handler.getParameter("user");
        SecurityHash hash    = new SecurityHash();
        SQLUpdateBuilder upd = new SQLUpdateBuilder(getUserTable());
        SQLSelectBuilder sel = new SQLSelectBuilder(getUserTable());
        upd.setWhere("UserId = '" + handler.getParameter("user") + '\'');
        hash.setAlgorithm(config.getHashAlgorithm());
        db.startTransaction();
        reply = new StringBuilder();
        sel.addField("UserId");
        sel.addField("State");
        sel.addField("Salt");
        sel.addField("Password");
        sel.addField("LatestLogin");
        sel.addField("ConsecutiveFails");
        sel.addField("MaxLoginAttempts");
        sel.addField("SuspendTime");
        sel.setWhere("UserId = '" + user + "'");
        ResultSet rs = db.executeQuery(sel.build());
        
        if (!rs.next()) {
            getReply().append("Invalid Login");
            db.rollback();
            return;
        } else {
            String state       = rs.getString("State");
            String salt        = rs.getString("Salt");
            String password    = rs.getString("Password");
            int    fails       = rs.getInt("ConsecutiveFails");
            int    maxAttempts = rs.getInt("MaxLoginAttempts");
            long   suspendTime = rs.getLong("SuspendTime");
            Date   last        = getDate(rs, "LatestLogin");
            
            if (salt == null) {
                salt = hash.getSalt();
                upd.addField("Salt", salt);
                updateUser(upd);
            }
            hash.setSalt(salt);
            
            if (state != null && state.equals("Suspended")) {
                if (suspendTime == 0) {
                    getReply().append("Your account has been suspended and must be reactivated by an administrator");
                    db.commit();
                    return;
                }
                long lapsed = (new Date().getTime() - last.getTime()) / 1000;
                if (lapsed < suspendTime) {
                    getReply().append("Your account has been suspended. Try again in " + (suspendTime - lapsed) + " seconds");
                    db.commit();
                    return;
                } else {
                    upd.addField("State", "Active");
                    upd.addField("ConsecutiveFails", 0);
                    state = "Active";
                    updateUser(upd);
                    fails = 0;
                }
            }
            if (password == null) {
                password = hash.getHash("password");
                upd.addField("Password", password);
                updateUser(upd);
            }
            upd.addField("LatestLogin", df.format(new Date()));
            if (!hash.getHash(handler.getParameter("password")).equals(password)) {
                upd.addIncrementField("LoginFails", 1);
                if (fails >= maxAttempts) {
                    upd.addField("State", "Suspended");
                    if (suspendTime == 0) {
                        getReply().append("Invalid Login. Max failures reached, account suspended and must be re-enabled by an administrator.");
                    } else {
                        getReply().append("Invalid Login. Max failures reached, account suspended for " + suspendTime + " minutes.");
                    }
                } else {
                    upd.addIncrementField("ConsecutiveFails", 1);
                    getReply().append("Invalid Login");
                }
                updateUser(upd);
                db.commit();
                return;
            }
            String newPassword = handler.getParameter("newpassword");
            
            if (newPassword.length() != 0) {
                upd.addField("Password", hash.getHash(newPassword));
            }
        }
        Connection c = db.getConnection();
        SQLInsertBuilder insert = new SQLInsertBuilder("Session");
        sessionId = hash.getRandomString(20);
        insert.addField("SessionId", sessionId);
        insert.addField("UserId", user);
        insert.addField("State", "Active");
        insert.addField("Host", host);
        insert.addField("Origin", origin);
        insert.addField("Protocol", protocol);
        insert.addField("Referrer", referrer);
        /*
         * Auto generated field no longer but have not changed code to simple insert statement.
         */
        PreparedStatement st = c.prepareStatement(insert.build(), Statement.RETURN_GENERATED_KEYS);
        st.executeUpdate();
        getReply().append("yes;" + sessionId);
        upd.addIncrementField("Logins", 1);
        upd.addField("State", "Active");
        upd.addField("ConsecutiveFails", 0);
        updateUser(upd);
        db.commit();
    }
    private void logOff(String state) throws SQLException {
        SQLUpdateBuilder sql = new SQLUpdateBuilder("Session");
        sql.addField("State", state);
        sql.addField(db.getProtocol().equals("mysql") ? "`End`" : "\"End\"", df.format(new Date()));
        sql.setWhere("SessionId = '" + sessionId + '\'');
        db.executeUpdate(sql.build());
        loggedIn = false;
    }

    public void logOff() throws SQLException {
        db.startTransaction();
        logOff("Closed");
        db.commit();
    }

    /**
     * @return the logInRequired
     */
    public boolean isSecurityFailure() {
        return securityFailure;
    }

    /**
     * @return the reply
     */
    public StringBuilder getReply() {
        return reply;
    }

    /**
     * @return the loggedIn
     */
    public boolean isLoggedIn() {
        return loggedIn;
    }
    
}
