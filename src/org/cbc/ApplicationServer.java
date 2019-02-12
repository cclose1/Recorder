/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Properties;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.cbc.application.reporting.Measurement;
import org.cbc.application.reporting.Report;
import org.cbc.application.reporting.Trace;
import org.cbc.application.reporting.Thread;
import org.cbc.application.reporting.Process;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLBuilder;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;
import org.cbc.utils.system.SecurityConfiguration;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public abstract class ApplicationServer extends HttpServlet { 

    protected String getListSql(Context ctx, String table, String field) throws ParseException {
        SQLSelectBuilder sql = ctx.getSelectBuilder(table);
        String[] filterFields = ctx.getParameter("filter").split(",");
        
        sql.setOptions("DISTINCT");
        sql.addField(field);
        sql.setWhere(field + " IS NOT NULL");
        
        for (String condition : filterFields) {
            String[] c = condition.split("!");
            if (c.length > 2) {
                throw new ParseException("Filter condition [" + condition + "] must be field!value", 0);
            }
            if (c.length == 2 && c[1].trim().length() != 0) {
                sql.addAnd(c[0], "=", c[1]);
            }
        }
        sql.setOrderBy(field);
        return sql.build();
    }
    protected void getList(Context ctx, String table, String field) throws SQLException, ParseException, JSONException {
        JSONObject data = new JSONObject();
        ResultSet  rs   = executeQuery(ctx, getListSql(ctx, table, field));

        data.add(field, rs);
        data.append(ctx.getReplyBuffer());

        ctx.setStatus(200);
    }
    protected void getList(Context ctx) throws SQLException, ParseException, JSONException {
        String table = ctx.getParameter("table");
        String field = ctx.getParameter("field");

        getList(ctx, table, field);
    }
    protected class Test {
        
    }
    public static long getPID() {
        String processName
                = java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
        return Long.parseLong(processName.split("@")[0]);
    }
    protected class Configuration implements SecurityConfiguration {        
        Properties properties = new Properties();
        
        protected class Databases {
            public class Login {
                String name;
                String user;
                String password;
                
                private boolean equals(String a, String b) {
                    if (a == null && b == null) return true;
                    if (a == null || b == null) return false;
                    
                    return (a.equals(b));
                }
                public void load(String name, String user, String password) {
                    this.name = name;
                    this.user = user;
                    this.password = password;
                }
                public boolean equals(Login login) {
                    return equals(name, login.name) && equals(user, login.user) && equals(password, login.password);
                }
            }
            protected Login application = new Login();
            protected Login security    = new Login();
            
            public void setApplication(String name, String user, String password) {
                Trace t = new Trace("setApplication");
                
                t.report('C', "Database " + name + " user " + user);
                application.load(name, user, password);
            }
            public void setSecurity(String name, String user, String password) {
                Trace t = new Trace("setSecurity");
                
                t.report('C', "Database " + name + " user " + user);
                security.load(name, user, password);
            }
        }
        protected Databases databases = new Databases();
        private String  appName;
        private String  dbServer;
        private String  deadlockRetries;
        private String  mysqlUseSSL;
        
        private String  hashAlgorithm;
        private boolean logRequest;
        private boolean logReply;
        private boolean loginRequired;
        private boolean measureSQL;
        private boolean sqlServerAvailable;
        private boolean sshRequired;
        
        public String getProperty(String name) {
            return properties.getProperty(name);
        }
        public int getIntProperty(String name, int defaultValue) {
            String value = getProperty(name);
            
            if (value == null) return defaultValue;
            
            try {
                return Integer.parseInt(value);
            } catch (NumberFormatException ex) {
                Report.error(null, "Property " + name + " value=" + value + " is not an integer defaulting to " + defaultValue);
            }        
            return defaultValue;
        }
        private String getenv(String name, boolean expand) {
            String env = System.getenv(name);
            
            if (env != null && env.startsWith("${") && expand) {
                env = System.getenv(env.substring(2, env.length() - 1));
            }
            return env == null? "" : env.trim();
        }
        private String getenv(String name) {
            return getenv(name, true);
        }
        private boolean getenvBoolean(String name, boolean ifNull) {
            String env = getenv(name, true).trim();
            
            if (env.equals("")) return ifNull;
            
            env = env.toLowerCase();
            
            return env.equals("true") || env.equals("t") || env.equals("yes") || env.equals("y");
        }
        private boolean getenvBoolean(String name) {
            return getenvBoolean(name, false);
        }
        public void load(ServletConfig config) throws IOException {
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            dbServer           = getenv("DATABASE_SERVER").length() == 0? "127.0.0.1" : getenv("DATABASE_SERVER");
            mysqlUseSSL        = getenv("DATABASE_USE_SSL");
            logRequest         = getenvBoolean("LOG_HTML_REQUEST");
            logReply           = getenvBoolean("LOG_HTML_REPLY");
            measureSQL         = getenvBoolean("MEASURE_SQL_QUERY");
            sqlServerAvailable = getenvBoolean("SQLSERVER_AVAILABLE");
            sshRequired        = getenvBoolean("SSH_REQUIRED");
            appName            = config.getServletName();
            deadlockRetries    = properties.getProperty("deadlockretries");
            hashAlgorithm      = properties.getProperty("hashalgorithm", "SHA");
            loginRequired      = properties.getProperty("loginrequired", "no").equalsIgnoreCase("yes");
            
            if (getenv("DATABASE_PORT").length() != 0) {
                dbServer += ":" + getenv("DATABASE_PORT");
            }
        }
        public boolean isSqlServerAvailable() {
            return sqlServerAvailable;
        }
        public String getAppName() {
            return appName;
        }
        public String getDbServer() {
            return dbServer;
        }
        public String getDeadlockRetries() {
            return deadlockRetries;
        }
        public String getMysqlUseSSL() {
            return mysqlUseSSL;
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
        public boolean getSSHRequired()
        {
            return sshRequired;
        }
        public boolean getMeasureSQL() {
            return measureSQL;
        }
        /*
         * To be removed.
        */
        public String getDefaultUserId() {
            return "";
        }
    }
    protected Configuration config = new Configuration();
    
    protected class Context {
        private DatabaseSession     appDb = null;
        private DatabaseSession     secDb = null;
        private HTTPRequestHandler  handler;
        private HttpServletResponse response;
        private StringBuilder       replyBuffer;
        
        public String getDbTimestamp(Date date) { 
            return date == null? null : (new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")).format(date);
        }
        public String getDbDate(Date date) { 
            return date == null? null : (new SimpleDateFormat("yyyy-MM-dd")).format(date);
        }
        public String getDbTime(Date date) { 
            return date == null? null : (new SimpleDateFormat("HH:mm:ss")).format(date);
        }
        public java.sql.Timestamp getSQLTimestamp(Date date) {
            return date == null? null : new java.sql.Timestamp(date.getTime());
        }
        private DatabaseSession openDatabase(Configuration.Databases.Login login, boolean useMySql) throws SQLException {
            Trace           t       = new Trace("openDatabase");
            DatabaseSession session = new DatabaseSession(useMySql? "mysql" : "sqlserver", config.getDbServer(), login.name);
            
            if (login.name != null) {
                t.report('C', "Database " + login.name);
                
                session.setUser(login.user, login.password);
                
                if (useMySql && config.getMysqlUseSSL().length() != 0) session.addConnectionProperty("useSSL", config.getMysqlUseSSL());
                
                session.connect();
                t.report('C', "Connection string " + session.getConnectionString());
            }   
            t.exit();
            
            return session;
        }
        public DatabaseSession getAppDb() {
            return appDb;
        }
        public DatabaseSession getSecDb() {
            return secDb == null? appDb : secDb;
        }
        private HTTPRequestHandler getHandler() {
            return handler;
        }
        public HttpServletResponse getResponse() {
            return response;
        }
        public StringBuilder getReplyBuffer() {
            return replyBuffer;
        }
        public String getParameter(String name, String nullDefault) {
            return handler.getParameter(name, nullDefault);
        }   
        public String getParameter(String name) {
            return handler.getParameter(name);
        }        
        public Date getTimestamp(String date, String time) throws ParseException {
            String dt = getParameter(date).trim();
            String tm = getParameter(time).trim();
            
            return dt.length() == 0 && tm.length() == 0? null : DateFormatter.parseDate(dt + ' ' + tm);
        }       
        public Date getTimestamp(String date) throws ParseException {
            String ts = getParameter(date);
            
            return ts.trim().length() == 0? null : DateFormatter.parseDate(ts);
        }   
        public java.sql.Timestamp getSQLTimestamp(String date) throws ParseException {
            Date ts = getTimestamp(date);
            
            return ts == null? null : getSQLTimestamp(ts);
        }         
        public Date getDate(String date) throws ParseException {
            return getTimestamp(date);
        }
        public void setStatus(int status) {
            handler.getResponse().setStatus(status);
        }
        public void dumpRequest(String reason) throws ServletException, IOException {            
            handler.dumpRequest(reason);
        }
        public void openDatabases(boolean useMySql) throws SQLException {
            appDb = openDatabase(config.databases.application, useMySql);
            
            if (!config.databases.application.equals(config.databases.security))
                secDb = openDatabase(config.databases.security, useMySql);
            else
                secDb = null;
        }
        public SQLSelectBuilder getSelectBuilder(String table) {
            SQLSelectBuilder builder = table == null? new SQLSelectBuilder() : new SQLSelectBuilder(table);
            
            builder.setProtocol(appDb.getProtocol());
            
            return builder;
        }
        public SQLUpdateBuilder getUpdateBuilder(String table) {
            SQLUpdateBuilder builder = new SQLUpdateBuilder(table);
            
            builder.setProtocol(appDb.getProtocol());
            
            return builder;
        }
        public SQLInsertBuilder getInsertBuilder(String table) {
            SQLInsertBuilder builder = new SQLInsertBuilder(table);
            
            builder.setProtocol(appDb.getProtocol());
            
            return builder;
        }
        public SQLDeleteBuilder getDeleteBuilder(String table) {
            SQLDeleteBuilder builder = new SQLDeleteBuilder(table);
            
            builder.setProtocol(appDb.getProtocol());
            
            return builder;
        }
    }
    protected void setNumericItemField(ResultSet rs, String name, String value, double scale) throws SQLException {
        
        if (value.length() == 0)
            rs.updateNull(name);
        else
            rs.updateDouble(name, Double.parseDouble(value) / scale);
    }
    private class MeasureSql {
        Measurement m = null;
        
        public void start() {
            if (config.getMeasureSQL())
                m = new Measurement();
            else
                m = null;
        }
        public void end(String sql) {
            if (m != null) {
                m.report(true, "Sql " + sql);
            }
        }
    }
    private MeasureSql measureSQL = new MeasureSql();
    
    protected ResultSet executeQuery(Context ctx, String sql) throws SQLException {
        measureSQL.start();
        ResultSet rs = ctx.getAppDb().executeQuery(sql);
        measureSQL.end(sql);
        return rs;
    }
    protected ResultSet executeQuery(Context ctx, SQLBuilder sql) throws SQLException {
        return executeQuery(ctx, sql.build());
    }
    protected ResultSet updateQuery(Context ctx, String sql) throws SQLException {
        measureSQL.start();
        ResultSet rs = ctx.getAppDb().updateQuery(sql);
        measureSQL.end(sql);
        return rs;
    }
    protected void updateQuery(Context ctx, SQLBuilder sql) throws SQLException {
        updateQuery(ctx, sql.build());
    }
    protected void executeUpdate(Context ctx, String sql) throws SQLException {
        measureSQL.start();
        ctx.getAppDb().executeUpdate(sql);
        measureSQL.end(sql);
    }
    protected void executeUpdate(Context ctx, SQLBuilder sql) throws SQLException {
        executeUpdate(ctx, sql.build());
    }
    public abstract String getVersion();
    public abstract void initApplication (ServletConfig config, Configuration.Databases databases) throws ServletException, IOException;
    public abstract void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException;
    
    private void processAction(Context ctx, Security security) throws ServletException, IOException, SQLException {
        Trace  t      = new Trace("ASProcessAction");
        String action = ctx.getParameter("action");
        /*
         * Assume failure, will be changed on a successful action.
         */
        ctx.setStatus(404);
        t.report('C', action);
        
        try {           
            if (action.equals("login")) {
                security.login();
                ctx.getReplyBuffer().append(security.getReply());
                ctx.setStatus(200);
            } else if (action.equals("logoff")) {
                security.logOff();
                ctx.setStatus(200);
            } else if (action.equals("enablemysql")) {
                /*
                 * This action does not require the user to be logged in.
                 */
                ctx.getReplyBuffer().append(config.isSqlServerAvailable()? "yes" : "no");
                ctx.setStatus(200);
            } else if (security.isSecurityFailure()) {
                ctx.getReplyBuffer().append(security.getReply());
                ctx.setStatus(200);        
            } else if (action.equals("loggedin")) {
                ctx.getReplyBuffer().append(security.isLoggedIn()? "true" : "false");
                ctx.setStatus(200);        
            } else if (action.equals("")) {
                ctx.getHandler().dumpRequest("No action parameter"); 
            } else {
                processAction(ctx, action);
            }
        } catch (NoSuchAlgorithmException ex) {
            Report.error(null, ex);
            ctx.getReplyBuffer().append(ex.getMessage());
        } catch (JSONException ex) {
            Report.error(null, ex);
            ctx.getReplyBuffer().append(ex.getMessage());
        } catch (ParseException ex) {
            Report.error(null, ex);
            ctx.getReplyBuffer().append(ex.getMessage());
        } finally {
            t.exit();
        }
    }    
    public void init(ServletConfig config) throws ServletException{ 
        super.init(config);
        String arRoot = System.getenv("AR_ROOT");
        String arFile = System.getenv("AR_FILE");
        Process.setReportingRoot(arRoot);
        
        if (arFile != null) Process.setConfigFile(arFile);
        
        Thread.attach(config.getServletName());
        Trace t = new Trace("initRequest");
        
        
        try {
            this.config.load(config);
            initApplication(config, this.config.databases);
            
            if (this.config.databases.security.name == null) {
                this.config.databases.setSecurity(
                        this.config.getProperty("secdatabase"),
                        this.config.getProperty("secuser"),
                        this.config.getProperty("secpassword"));
            }
        } catch (IOException ex) {
            Report.error(null, "IOException reading servlet properties", ex);
        }
        Report.comment(null, 
                "Version "        + getVersion() + 
                " Home Dir "      + System.getProperty("user.home") +
                " Current Dir "   + System.getProperty("user.dir")  +
                " Report Config " + Process.getConfigFile().getAbsoluteFile());
        t.report('C', "Servlet name " + config.getServletName() + " started");
        t.exit();
    }
    protected void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        Thread.attach(config.getAppName());
        Measurement m   = new Measurement();
        Trace       t   = new Trace("processRequest");
        Context     ctx = new Context();    
        response.setContentType("text/html;charset=UTF-8");
     
        ctx.handler     = new HTTPRequestHandler(request, response);
        ctx.replyBuffer = new StringBuilder();
        /*
         * Assume failure, will be changed on a successful action.
         */
        ctx.setStatus(404);
        
        String  action     = ctx.getParameter("action");
        boolean useMySql   = ctx.getParameter("mysql").equalsIgnoreCase("true");
        int     maxRepeats = 5;
        int     repeat     = 0;
        
        try {
            Report.comment(null, "processRequest called with action " + action + " sessionId " + ctx.getHandler().getCookie("sessionid") + " mysql " + useMySql + " default " + System.getProperty("user.dir"));
            
            if (!config.isSqlServerAvailable()) useMySql = true;
            
            t.report('C', "action " + action + " server " + config.getDbServer() + " database " + config.databases.application.name + " user " + config.databases.application.user);

            ctx.openDatabases(useMySql || !config.isSqlServerAvailable());
            
            Security security = new Security(ctx.getSecDb(), request, config);
            
            while (repeat <= maxRepeats) {
                try {
                    security.checkSession(repeat);
                    processAction(ctx, security);
                    break;
                } catch (SQLException ex) {
                    t.report('C', "Exception", ex.getMessage());
                    
                    if (ctx.getAppDb().getStandardError(ex) != DatabaseSession.Error.Deadlock || repeat == maxRepeats) {
                        throw ex;
                    }
                    ctx.getReplyBuffer().setLength(0);
                    repeat++;
                }
            }            
        } catch (SQLException ex) {
            Report.error(null, "SQL error " + ex.getErrorCode() + " state " + ex.getSQLState(), ex);
            ctx.getReplyBuffer().append(ex.getMessage());
            try {
                if (ctx.getAppDb() != null) ctx.getAppDb().rollback();
            } catch (SQLException rb) {
                Report.error(null, "Rollback", rb);                
            }
        } catch (ParseException ex) {
            Report.error(null, ex);
        }
        if (repeat != 0) t.report('C', "Deadlock count " + repeat);
        
        t.report('C', "Starting response");
        response.getWriter().println(ctx.getReplyBuffer().toString());
        t.report('C', "Response added");
        
        if (response.getStatus() != 200) t.report('C', ctx.getReplyBuffer().toString());
        
        if (config.getLogReply()) Report.comment(null, ctx.getReplyBuffer().toString());
        
        t.exit();
        m.report(true, "Action " + action);
        Thread.detach();
    }
    public void destroy() {
        Thread.attach(config.getAppName());
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
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
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
