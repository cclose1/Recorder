/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLInsertBuilder;
import java.io.IOException;
import java.io.PrintWriter;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.ParseException;
import java.util.Date;
import java.util.Enumeration;
import java.util.Properties;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.cbc.application.reporting.Measurement;
import org.cbc.application.reporting.Report;
import org.cbc.application.reporting.Trace;
import org.cbc.application.reporting.Thread;
import org.cbc.application.reporting.Process;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.Calendar;
import org.cbc.utils.system.DateFormatter;
import org.cbc.utils.system.SecurityConfiguration;
import org.cbc.utils.system.SecurityHash;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public class OldRecordSpend extends HttpServlet { 

    public static long getPID() {
        String processName
                = java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
        return Long.parseLong(processName.split("@")[0]);
    }
    private String getCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return "";
        
        for (Cookie cookie : request.getCookies()) {
            if (cookie.getName().equals(name)) return cookie.getValue();
        }
        return "";
    }
    private class Configuration implements SecurityConfiguration {        
        Properties properties = new Properties();
        
        private String  name;
        private String  dbServer;
        private String  database;
        private String  dbUser;
        private String  dbPassword;
        private String  deadlockRetries;
        
        private String  readTable;
        private String  updateTable;
        private String  optionalColumns;
        private int     historyDays;        
        private String  hashAlgorithm;
        private boolean logRequest;
        private boolean logReply;
        private boolean loginRequired;
        private String  defaultUserId;
        private String  openShiftHost;
        
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
        public void load(ServletConfig config) throws IOException {
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            name            = config.getServletName();
            database        = properties.getProperty("spendname");
            dbServer        = properties.getProperty("dbserver");
            dbUser          = properties.getProperty("dbuser");
            dbPassword      = properties.getProperty("dbpassword");
            deadlockRetries = properties.getProperty("deadlockretries");
            readTable       = properties.getProperty("spendreadtable");
            updateTable     = properties.getProperty("spendupdatetable");
            optionalColumns = properties.getProperty("spendoptionalcolumns");
            historyDays     = getIntProperty("spendhistorydays", 100);
            hashAlgorithm   = properties.getProperty("hashalgorithm", "SHA");
            logRequest      = properties.getProperty("logrequest", "no").equalsIgnoreCase("yes");
            logReply        = properties.getProperty("logrequest", "no").equalsIgnoreCase("yes");
            loginRequired   = properties.getProperty("loginrequired", "yes").equalsIgnoreCase("yes");
            defaultUserId   = properties.getProperty("defaultuserid", "");
            openShiftHost   = System.getenv("OPENSHIFT_MYSQL_DB_HOST");
            
            if (openShiftHost != null && openShiftHost.length() != 0) {
                dbServer = openShiftHost + ':' + System.getenv("OPENSHIFT_MYSQL_DB_PORT");
            } else
                openShiftHost = "";
        }
        public boolean isOpenShift() {
            return openShiftHost.length() != 0;
        }
        public String getName() {
            return name;
        }
        public String getDbServer() {
            return dbServer;
        }
        public String getDatabase() {
            return database;
        }
        public String getDbUser() {
            return dbUser;
        }
        public String getDbPassword() {
            return dbPassword;
        }
        public String getDeadlockRetries() {
            return deadlockRetries;
        }
        public String getOpenShiftHost() {
            return openShiftHost;
        }
        public String getReadTable() {
            return readTable;
        }
        public String getUpdateTable() {
            return updateTable;
        }
        public String getOptionalColumns() {
            return optionalColumns;
        }
        public int getHistoryDays() {
            return historyDays;
        }
        public String getHashAlgorithm() {
            return hashAlgorithm;
        }
        public boolean getLogRequest() {
            return logRequest;
        }
        public boolean getLogReply() {
            return logReply;
        }
        public boolean getLoginRequired() {
            return loginRequired;
        }
        public String getDefaultUserId() {
            return defaultUserId;
        }
    }
    Configuration config = new Configuration();
    
    private class Security1 {
        private boolean            loggedIn        = false;
        private boolean            securityFailure = false;
        private String             sessionId       = "";
        private StringBuilder      reply           = new StringBuilder();
        private DatabaseSession    db;
        private HttpServletRequest request;
        private String             host            = null;
        private String             protocol        = null;
        private String             origin          = null;
        private String             referrer        = null;
        private DateFormatter      df              = new DateFormatter("yyyy-MM-dd HH:mm:ss");
        
        private String getUserTable() {
            return db.getProtocol().equals("mysql")? "Expenditure.User" : "\"User\"";
        }  
        public Security1(DatabaseSession db, HttpServletRequest request) {       
            Trace t = new Trace("Security");
            
            this.db      = db;
            this.request = request;
            
            sessionId     = getCookie(request, "sessionid");            
            host          = request.getServerName();
            protocol      = request.getProtocol();
            origin        = request.getHeader("origin");
            referrer      = request.getHeader("referer");
            
            t.exit();
        }            
        public void checkSession(int deadlocks) throws SQLException, ParseException { 
            SQLSelectBuilder sql;      
            Trace t = new Trace("checkSession");

            boolean logInRequired = true;
            String  source        = origin == null? referrer : origin;
            
            if (config.getLogRequest()) dumpRequest(request);
            
            if (source.startsWith("http://local"))
                logInRequired = false;
            else if (!source.startsWith("https://")) {
                reply.append("securityfailure;httpsrequired;");
                securityFailure = true;
            }
            if (!loggedIn && !sessionId.isEmpty() && reply.length() == 0) {
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
                sql.setFrom(
                        "Session S "   +
                        "JOIN " + getUserTable() + " U "  + 
                        "ON  S.UserId = U.UserId");
                sql.setWhere("SessionId = '" + sessionId + "' AND   S.State = 'Active'");
                ResultSet rs = db.updateQuery(sql.build());
                r.exit();
                
                if (rs.next()) {
                    int  count   = rs.getInt("Accesses");
                    long maxIdle = 60000 * rs.getInt("MaxIdleTime");
                    Date last    = getDate(rs, "Last");
                    
                    deadlocks += rs.getInt("Deadlocks");
                    t.report('C', "Deadlocks read");
                    
                    if (maxIdle != 0 && last != null && new Date().getTime() - last.getTime() > maxIdle) {
                        logOff("Timed Out");
                        reply.append("securityfailure;Session Timed Out");
                        securityFailure = true;
                    } else {        
                        Trace s   = new Trace("checkSession Update", 'L');
                        
                        sql = new SQLSelectBuilder("Session");
                        
                        sql.setParameter("SessionId", sessionId);
                        sql.addField("SeqNo");
                        sql.addField("SessionId");
                        sql.addField("Last");
                        sql.addField("Accesses");
                        sql.addField("Deadlocks");
                        sql.setWhere("SessionId = ?SessionId AND State = 'Active'");
                        PreparedStatement pst = db.prepareStatement(
                                sql.resolve(true), 
                                ResultSet.TYPE_FORWARD_ONLY, 
                                ResultSet.CONCUR_UPDATABLE);
                        sql.setParameters(pst);
                        rs = pst.executeQuery();
                        
                        if (rs.next()) {
                            rs.moveToCurrentRow();
                            rs.updateTimestamp("Last", new java.sql.Timestamp((new Date()).getTime()));
                            rs.updateInt("Accesses",  count + 1);
                            rs.updateInt("Deadlocks", deadlocks);
                            rs.updateRow();
                        }
                        s.exit();
                        loggedIn = true;
                    }
                }
                db.commit();
            } 
            if (!securityFailure && !loggedIn && (logInRequired || config.getLoginRequired())) {
                securityFailure = true;
                reply.append("securityfailure;notloggedin;" + config.getDefaultUserId());
            }
            if (reply.length() != 0) Report.comment(null, reply.toString());
            
            t.exit();
        }  
        
        private Date getDate(ResultSet rs, String name) throws SQLException {
            java.sql.Timestamp date = rs.getTimestamp(name);

            if (date == null) return null;
            
            return new Date(date.getTime());
        }
        private void updateUser(SQLUpdateBuilder sql) throws SQLException {
            db.executeUpdate(sql.build());
            sql.clearFields();
        }
        public void login() throws SQLException, NoSuchAlgorithmException {
            String           user = getParameter(request, "user");
            SecurityHash     hash = new SecurityHash();
            SQLUpdateBuilder upd  = new SQLUpdateBuilder(getUserTable());
            SQLSelectBuilder sel  = new SQLSelectBuilder(getUserTable());
            
            upd.setWhere("UserId = '" + getParameter(request, "user") + '\'');
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
                
                if (!hash.getHash(getParameter(request, "password")).equals(password)) {
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
                String newPassword = getParameter(request, "newpassword");
                
                if (newPassword.length() != 0) {
                    upd.addField("Password", hash.getHash(newPassword));
                }
            }
            Connection       c      = db.getConnection();
            SQLInsertBuilder insert = new SQLInsertBuilder("Session");
            sessionId = hash.getRandomString(20);
         
            insert.addField("SessionId", sessionId);
            insert.addField("UserId",    user);
            insert.addField("State",     "Active");
            insert.addField("Host",      host);
            insert.addField("Origin",    origin);
            insert.addField("Protocol",  protocol);
            insert.addField("Referrer",  referrer);    
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
            
            db.startTransaction();
            sql.addField("State", state);
            sql.addField(db.getProtocol().equals("mysql")? "`End`" : "\"End\"", df.format(new Date()));
            sql.setWhere("SessionId = '" + sessionId + '\'');
            db.executeUpdate(sql.build());
            db.commit();
            loggedIn = false;
        }
        public void logOff() throws SQLException {
            logOff("Closed");
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
    
    private void dumpLine(PrintWriter out, String text) {
        if (out != null) out.println(text);
        
        Report.comment(null, text);
    }
    private void dumpRequest(HttpServletRequest request) {
        for (Enumeration e = request.getHeaderNames(); e.hasMoreElements();) {
            String name = (String) e.nextElement();
            
            dumpLine(null, "Property " + name + "=" + request.getHeader(name));
        }
        for (Enumeration e = request.getParameterNames(); e.hasMoreElements();) {
            String parameter = (String) e.nextElement();
            
            dumpLine(null, "Parameter " + parameter + "= " + request.getParameter(parameter));
        }
    }
    private void dumpRequest(HttpServletRequest request, HttpServletResponse response, String reason) throws ServletException, IOException {

        PrintWriter out = response == null? null : response.getWriter();
        try {
            dumpLine(out, "Servlet Message " + request.getContextPath() + " fail reason " + reason);
            dumpLine(out, "Query String    " + request.getQueryString());

            for (Enumeration e = request.getParameterNames(); e.hasMoreElements();) {
                String parameter = (String) e.nextElement();
                dumpLine(out, "Parameter       " + parameter + "= " + request.getParameter(parameter));      
            }
        } finally {
            if (out != null) out.close();
        }
    }
    private String getParameter(HttpServletRequest request, String name) {
        String value = request.getParameter(name);
        return value == null ? "" : value;
    }

    /**
     * Processes requests for both HTTP
     * <code>GET</code> and
     * <code>POST</code> methods.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    private void setDataFields(ResultSet rs, HttpServletRequest request, String date) throws SQLException {
        rs.updateString("Timestamp",      date + ' ' + getParameter(request, "time"));
        rs.updateString("Category",       getParameter(request, "category"));
        rs.updateString("Type",           getParameter(request, "type"));
        rs.updateString("Location",       getParameter(request, "location"));
        rs.updateString("Description",    getParameter(request, "description"));
        rs.updateString("Amount",         getParameter(request, "amount"));
        rs.updateString("Payment",        getParameter(request, "payment"));
        rs.updateString("BankCorrection", getParameter(request, "bankcorrection"));
    }
    private void setDataFields(
            ResultSet rs,  
            Date      date,
            String    category,
            String    type,
            String    location,
            String    description,
            String    amount,
            String    payment,
            String    bankcorrection) throws SQLException {        
        rs.updateTimestamp("Timestamp", new java.sql.Timestamp(date.getTime()));
        rs.updateString("Category",       category);
        rs.updateString("Type",           type);
        rs.updateString("Location",       location);
        rs.updateString("Description",    description);
        rs.updateString("Amount",         amount);
        rs.updateString("Payment",        payment);
        rs.updateString("BankCorrection", bankcorrection.length() == 0? "0" : bankcorrection);
    }    
    private void setDataFields(ResultSet rs, HttpServletRequest request, Date date) throws SQLException {
        setDataFields(
                rs,
                date,
                getParameter(request, "category"),
                getParameter(request, "type"),
                getParameter(request, "location"),
                getParameter(request, "description"),
                getParameter(request, "amount"),
                getParameter(request, "payment"),
                getParameter(request, "bankcorrection"));
    }
    /*
     * Copies the monthly fields for year and month in Date which defaults to todays date if null.
     * If there are already monthly fields for year and month no action is taken as they have already been copied.
     *
     * The monthly fields from the previous month are copied adding 1 to the month of the timestamp field.
     *
     * This could be done using a single insert select statement. However, adding a month to a DATETIME field differs
     * for each database. The code in this routine should work for all databases.
     */
    private void copyFixed(DatabaseSession db, String read, String update, Date date, String period) throws SQLException {
        Trace t = new Trace("copyFixed");
        
        SQLSelectBuilder sel       = new SQLSelectBuilder(read);
        Calendar         cal       = new Calendar();
        int              count     = 0;
        int              increment = period.equalsIgnoreCase("Y")? 12 : 1;
        ResultSet rsi;
      
        if (date != null) cal.setTime(date);
        
        sel.addAnd("Year",   "=", cal.getYear());
        sel.addAnd("Month",  "=", cal.getMonth());
        sel.addAnd("Period", "=", period);
        sel.addValueField("Count", "Count(*)");
        ResultSet rsr   = db.executeQuery(sel.build());
        
        if (rsr.next()) count = rsr.getInt("Count");
        
        rsr.close();
        t.report('r', "Count " + count);
        
        if (count == 0) {
            cal.incrementMonth(-increment);
            sel.clearFields();
            sel.clearWhere();
            sel.addField("Timestamp");
            sel.addField("IncurredBy");
            sel.addField("Category");
            sel.addField("Type");
            sel.addField("Location");
            sel.addField("Description");
            sel.addField("Amount");
            sel.addField("Payment");
            sel.addField("BankCorrection");
            sel.addAnd("Year",   "=", cal.getYear());
            sel.addAnd("Month",  "=", cal.getMonth());
            sel.addAnd("Period", "=", period);
            t.report('r', "Copy period " + period + " year " + cal.getYear() + " month "  + cal.getMonth());
            rsr = db.executeQuery(sel.build());
        
            rsi = db.insertTable(update);
            
            while (rsr.next()) {
                cal.setTime(rsr.getTimestamp("Timestamp").getTime());
                cal.incrementMonth(increment);
                rsi.moveToInsertRow();
                rsi.updateString("IncurredBy", rsr.getString("IncurredBy"));
                rsi.updateString("Period",     period);
                setDataFields (
                        rsi,
                        cal.getTime(),
                        rsr.getString("Category"),
                        rsr.getString("Type"),
                        rsr.getString("Location"),
                        rsr.getString("Description"),
                        rsr.getString("Amount"),
                        rsr.getString("Payment"),
                        rsr.getString("BankCorrection"));
                rsi.insertRow();
            }
        }
        t.exit();
    }
    private void processAction(
            Security            security,
            DatabaseSession     db, 
            HttpServletRequest  request, 
            HttpServletResponse response,
            StringBuilder       replyBuffer) throws ServletException, IOException, SQLException {
        String        action = getParameter(request, "action");
        DateFormatter df     = new DateFormatter("yyyy-MM-dd");
        boolean       mySql  = db.getProtocol().equals("mysql");
        /*
         * Assume failure, will be changed on a successful action.
         */
        response.setStatus(404);
            
        try {           
            if (action.equals("login")) {
                security.login();
                replyBuffer.append(security.getReply());
                response.setStatus(200);
            } else if (action.equals("logoff")) {
                security.logOff();
                response.setStatus(200);
            } else if (action.equals("enablemysql")) {
                /*
                 * This action does not require the user to be logged in.
                 */
                replyBuffer.append(!config.isOpenShift()? "yes" : "no");
                response.setStatus(200);
            } else if (security.isSecurityFailure()) {
                replyBuffer.append(security.getReply());
                response.setStatus(200);        
            } else if (action.equals("loggedin")) {
                replyBuffer.append(security.isLoggedIn()? "true" : "false");
                response.setStatus(200);        
            } else if (action.equals("")) {
                dumpRequest(request, response, "No action parameter");
            } else if (action.equals("deletespend")) {
                db.executeUpdate("DELETE FROM " + config.getUpdateTable() + " WHERE SeqNo = " + getParameter(request, "seqno"));
                response.setStatus(200);
            } else if (action.equals("savespend")) {
                String    seqNo = getParameter(request, "seqno");
                Date      date  = DateFormatter.parseDate(getParameter(request, "date") + ' ' + getParameter(request, "time"));
                ResultSet rs;
                
                db.startTransaction();
                
                if (seqNo.length() == 0) {
                    rs = db.insertTable(config.getUpdateTable());
                    rs.moveToInsertRow();
                    setDataFields(rs, request, date);
                    rs.insertRow();
                    response.setStatus(200);
                } else {
                    rs = db.updateQuery(
                        "SELECT SeqNo, Timestamp, Category, Type, Description, Location, Amount, Payment, BankCorrection" + 
                        " FROM "          + config.getUpdateTable() + 
                        " WHERE SeqNo = " + seqNo);
                    
                    if (!rs.next())
                        replyBuffer.append("No record for SeqNo " + seqNo);
                    else {
                        rs.moveToCurrentRow();
                        setDataFields(rs, request, date);
                        rs.updateRow();
                        response.setStatus(200);
                    }
                }
                rs.close();
                db.commit();
            } else if (action.equals("spendhistory")) {                
                JSONObject      data = new JSONObject();
                SQLSelectBuilder sql = new SQLSelectBuilder(config.getReadTable());
                
                copyFixed(db, config.getReadTable(), config.getUpdateTable(), null, "M");
                copyFixed(db, config.getReadTable(), config.getUpdateTable(), null, "Y");
                /*
                 * Ideally the calculation for start point of history should be done in SQL. However, there
                 * is a different interpretation of the ASCII SQL time functions between MySQL and SQL Server,
                 * so do it in Java.
                 */
                String    hs = df.format(new Date(System.currentTimeMillis() - (long)1000 * config.getHistoryDays() * 24 * 60 * 60));          
                sql.addField("SeqNo");
                sql.addField("Timestamp");
                sql.addField("Weekday");
                sql.addField("Category");
                sql.addField("Type");
                sql.addValueField("Description", "COALESCE(Description, '')");
                sql.addValueField( "Location",   "COALESCE(Location, '')");
                sql.addField("Payment");
                sql.addValueField("Amount",      "CAST(Amount AS DECIMAL(10,2))");
                sql.addValueField("Correction",  "CAST(BankCorrection AS DECIMAL(10,2))");
                sql.setWhere("CAST(Timestamp AS DATE) >= '" + hs + "'");
                sql.setOrderBy("Timestamp DESC");
                ResultSet rs = db.executeQuery(sql.build());
                data.add("SpendData", rs, config.getOptionalColumns());
                data.append(replyBuffer);
                response.setStatus(200);
            } else if (action.equals("getList")) {
                JSONObject    data     = new JSONObject();
                String        field    = getParameter(request, "name");
                String        category = getParameter(request, "category");
                String        type     = getParameter(request, "type");
                StringBuilder sql      = new StringBuilder();
                
                if (category != null && category.length() == 0) category = null;
                if (type     != null && type.length()     == 0) type     = null;
                
                if (category == null && type == null) {
                    sql.append("SELECT Value FROM ListValues WHERE Type = '" + field + "' ORDER BY Value");
                } else {
                    sql.append(
                            "SELECT DISTINCT " + field + 
                            " FROM SpendData " + 
                            "WHERE "    + field + " IS NOT NULL");
                    
                    if (category != null) sql.append(" AND Category = '" + category + '\'');
                    if (type     != null) sql.append(" AND Type     = '" + type     + '\'');
                    
                    sql.append(" ORDER BY ");
                    sql.append(field);
                }
                ResultSet rs = db.executeQuery(sql.toString());
                
                data.add(field, rs);
                data.append(replyBuffer);

                response.setStatus(200);
            } else if (action.equals("summaryfields")) {
                String     sql    = mySql? "CALL Summary(NULL, NULL, 'Y')" : "EXEC Summary NULL, NULL";
                JSONArray  fields = new JSONArray();
                String     named  = getParameter(request, "name");
                ResultSet  rs     = db.executeQuery(sql);
                
                fields.addFields(rs);
                
                if (named == null || named.length() == 0)
                    fields.append(replyBuffer);
                else {
                    JSONObject data = new JSONObject();
                    
                    data.add(named, fields);
                    data.append(replyBuffer);
                }
                response.setStatus(200);
            } else if (action.equals("checktimestamp")) {
                String    seqNo     = getParameter(request, "seqno");
                String    timestamp = getParameter(request, "date") + ' ' + getParameter(request, "time");
                ResultSet        rs = db.executeQuery("SELECT SeqNo FROM " + config.getUpdateTable() + " WHERE Timestamp = '" + timestamp + "'");
                
                if (rs.next() && !seqNo.equals(rs.getString("SeqNo"))) {
                    replyBuffer.append("Change time as details already recorded for " + timestamp);
                }  
                response.setStatus(200);
            } else {
                dumpRequest(request, response, "Action " + action + " is invalid");
                replyBuffer.append("Action " + action + " is invalid");     
            }
        } catch (NoSuchAlgorithmException ex) {
            Report.error(null, ex);
            replyBuffer.append(ex.getMessage());
        } catch (JSONException ex) {
            Report.error(null, ex);
            replyBuffer.append(ex.getMessage());
        } catch (ParseException ex) {
            Report.error(null, ex);
            replyBuffer.append(ex.getMessage());
        }
    }
    public void init(ServletConfig config) throws ServletException{ 
        String version = "V1.0 Released 15-Jul-2014 14:57";    

        super.init(config);  
        Process.setConfigFile("ARConfig.cfg");
  
        Thread.attach(config.getServletName());
        Trace t = new Trace("processRequest");
        
        try {
            this.config.load(config);
        } catch (IOException ex) {
            Report.error(null, "IOException reading servlet properties", ex);
        }
        Report.comment(null, "Version " + version);
        t.report('C', "Servlet name " + config.getServletName() + " started");
        t.exit();
    }
    protected void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        Thread.attach(config.getName());
        Measurement m = new Measurement();
        Trace       t = new Trace("processRequest");
            
        response.setContentType("text/html;charset=UTF-8");
            
        DatabaseSession db            = new DatabaseSession();
        String          action        = getParameter(request, "action");
        StringBuilder   replyBuffer   = new StringBuilder();
        boolean         useMySql      = getParameter(request, "mysql").equalsIgnoreCase("true");
        int             maxRepeats    = 5;
        int             repeat        = 0;
           
        try {
            Report.comment(null, "processRequest called with action " + action + " sessionId " + getCookie(request, "sessionid") + " mysql " + useMySql + " default " + System.getProperty("user.dir"));
            
            if (config.isOpenShift()) useMySql = true;
            
            t.report('C', "action " + action + " server " + config.getDbServer() + " database " + config.getDatabase() + " user " + config.getDbUser());

            if (useMySql)
                db.open("mysql", "com.mysql.jdbc.Driver", config.getDbServer(), config.getDatabase(), config.getDbUser(), config.getDbPassword());
            else
                db.open(config.getDbServer(), config.getDatabase(), config.getDbUser(), config.getDbPassword());
            
            Security security = new Security(db, request, config);
            
            while (repeat <= maxRepeats) {
                try {
                    security.checkSession(repeat);
                    processAction(security, db, request, response, replyBuffer);
                    break;
                } catch (SQLException ex) {
                    if (db.getStandardError(ex) != DatabaseSession.Error.Deadlock || repeat == maxRepeats) {
                        throw ex;
                    }
                    replyBuffer.setLength(0);
                    repeat++;
                }
            }            
        } catch (SQLException ex) {
            Report.error(null, "SQL error " + ex.getErrorCode() + " state " + ex.getSQLState(), ex);
            replyBuffer.append(ex.getMessage());
            try {
                db.rollback();
            } catch (SQLException rb) {
                Report.error(null, "Rollback", rb);                
            }
        } catch (ParseException ex) {
            Report.error(null, ex);
        }
        if (repeat != 0) t.report('C', "Deadlock count " + repeat);
        
        response.getWriter().println(replyBuffer.toString());
        
        if (response.getStatus() != 200) t.report('C', replyBuffer.toString());
        
        t.exit();
        m.report(true, "Action " + action);
        Thread.detach();
    }
    public void destroy() {
        Thread.attach(config.getName());
        Report.comment(null, "Servlet stopped");
    }
    // <editor-fold defaultstate="collapsed" desc="HttpServlet methods. Click on the + sign on the left to edit the code.">
    /**
     * Handles the HTTP
     * <code>GET</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Handles the HTTP
     * <code>POST</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Returns a short description of the servlet.
     *
     * @return a String containing servlet description
     */
    @Override
    public String getServletInfo() {
        return "Short description";
    }// </editor-fold>
}
