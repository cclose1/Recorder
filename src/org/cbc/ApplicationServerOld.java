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
import org.cbc.sql.SQLBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.SecurityConfiguration;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public abstract class ApplicationServerOld extends HttpServlet { 
    protected class Test {
        
    }
    public static long getPID() {
        String processName
                = java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
        return Long.parseLong(processName.split("@")[0]);
    }
    protected class Configuration implements SecurityConfiguration {        
        Properties properties = new Properties();
        
        private String  name;
        private String  dbServer;
        private String  database;
        private String  dbUser;
        private String  dbPassword;
        private String  deadlockRetries;
        
        private String  hashAlgorithm;
        private boolean logRequest;
        private boolean logReply;
        private boolean loginRequired;
        private boolean measureSQL;
        private String  defaultUserId;
        private String  openShiftHost;
        
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
        public void load(ServletConfig config) throws IOException {
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            name            = config.getServletName();
            database        = properties.getProperty("bpname");
            dbServer        = properties.getProperty("dbserver");
            dbUser          = properties.getProperty("dbuser");
            dbPassword      = properties.getProperty("dbpassword");
            deadlockRetries = properties.getProperty("deadlockretries");
            hashAlgorithm   = properties.getProperty("hashalgorithm", "SHA");
            logRequest      = properties.getProperty("logrequest", "no").equalsIgnoreCase("yes");
            logReply        = properties.getProperty("logreply", "no").equalsIgnoreCase("yes");
            loginRequired   = properties.getProperty("loginrequired", "no").equalsIgnoreCase("yes");
            measureSQL      = properties.getProperty("measureSQL", "no").equalsIgnoreCase("yes");
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
        public boolean getMeasureSQL() {
            return measureSQL;
        }
        public String getDefaultUserId() {
            return defaultUserId;
        }
    }
    protected Configuration config = new Configuration();
    
    protected class Context {
        private DatabaseSession     db;
        private HTTPRequestHandler  handler;
        private HttpServletResponse response;
        private StringBuilder       replyBuffer;

        public DatabaseSession getDb() {
            return db;
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
        public String getParameter(String name) {
            return handler.getParameter(name);
        }        
        public void setStatus(int status) {
            handler.getResponse().setStatus(200);
        }
        public void dumpRequest(String reason) throws ServletException, IOException {            
            handler.dumpRequest(reason);
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
        ResultSet rs = ctx.getDb().executeQuery(sql);
        measureSQL.end(sql);
        return rs;
    }
    protected ResultSet executeQuery(Context ctx, SQLBuilder sql) throws SQLException {
        return executeQuery(ctx, sql.build());
    }
    protected ResultSet updateQuery(Context ctx, String sql) throws SQLException {
        measureSQL.start();
        ResultSet rs = ctx.getDb().updateQuery(sql);
        measureSQL.end(sql);
        return rs;
    }
    protected void updateQuery(Context ctx, SQLBuilder sql) throws SQLException {
        updateQuery(ctx, sql.build());
    }
    protected void executeUpdate(Context ctx, String sql) throws SQLException {
        measureSQL.start();
        ctx.getDb().executeUpdate(sql);
        measureSQL.end(sql);
    }
    protected void executeUpdate(Context ctx, SQLBuilder sql) throws SQLException {
        executeUpdate(ctx, sql.build());
    }
    public abstract String getVersion();
    public abstract void initApplication (ServletConfig config) throws ServletException, IOException;
    public abstract void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException;
    
    private void processAction(Context ctx, Security security) throws ServletException, IOException, SQLException {
        Trace t = new Trace("ASProcessAction");
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
                ctx.getReplyBuffer().append(!config.isOpenShift()? "yes" : "no");
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
        Process.setConfigFile("ARConfig.cfg");
  
        Thread.attach(config.getServletName());
        Trace t = new Trace("processRequest");
        
        try {
            this.config.load(config);
            initApplication(config);
        } catch (IOException ex) {
            Report.error(null, "IOException reading servlet properties", ex);
        }
        Report.comment(null, "Version " + getVersion());
        t.report('C', "Servlet name " + config.getServletName() + " started");
        t.exit();
    }
    protected void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        Thread.attach(config.getName());
        Measurement m   = new Measurement();
        Trace       t   = new Trace("processRequest");
        Context     ctx = new Context();    
        response.setContentType("text/html;charset=UTF-8");
        
        ctx.db          = new DatabaseSession();
        ctx.handler     = new HTTPRequestHandler(request, response);
        ctx.replyBuffer = new StringBuilder();
        
        String  action     = ctx.getParameter("action");
        boolean useMySql   = ctx.getParameter("mysql").equalsIgnoreCase("true");
        int     maxRepeats = 5;
        int     repeat     = 0;
        
        try {
            Report.comment(null, "processRequest called with action " + action + " sessionId " + ctx.getHandler().getCookie("sessionid") + " mysql " + useMySql + " default " + System.getProperty("user.dir"));
            
            if (config.isOpenShift())   useMySql = true;
            
            t.report('C', "action " + action + " server " + config.getDbServer() + " database " + config.getDatabase() + " user " + config.getDbUser());

            if (useMySql)
                ctx.getDb().open("mysql", "com.mysql.jdbc.Driver", config.getDbServer(), config.getDatabase(), config.getDbUser(), config.getDbPassword());
            else
                ctx.getDb().open(config.getDbServer(), config.getDatabase(), config.getDbUser(), config.getDbPassword());
            
            Security security = new Security(ctx.getDb(), request, config);
            
            while (repeat <= maxRepeats) {
                try {
                    security.checkSession(repeat);
                    processAction(ctx, security);
                    break;
                } catch (SQLException ex) {
                    t.report('C', "Exception", ex.getMessage());
                    
                    if (ctx.getDb().getStandardError(ex) != DatabaseSession.Error.Deadlock || repeat == maxRepeats) {
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
                ctx.getDb().rollback();
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
