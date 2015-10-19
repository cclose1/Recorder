/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import org.cbc.sql.SQLSelectBuilder;
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
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;
import org.cbc.utils.system.SecurityConfiguration;

/**
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public class OldRecordNutrition1 extends HttpServlet { 

    public static long getPID() {
        String processName
                = java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
        return Long.parseLong(processName.split("@")[0]);
    }
    private class Configuration implements SecurityConfiguration {        
        Properties properties = new Properties();
        
        private String  name;
        private String  dbServer;
        private String  database;
        private String  dbUser;
        private String  dbPassword;
        private String  deadlockRetries;
        
        private int     historyRows;        
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
            database        = properties.getProperty("bpname");
            dbServer        = properties.getProperty("dbserver");
            dbUser          = properties.getProperty("dbuser");
            dbPassword      = properties.getProperty("dbpassword");
            deadlockRetries = properties.getProperty("deadlockretries");
            historyRows     = getIntProperty("nutritionhistoryrows", 100);
            hashAlgorithm   = properties.getProperty("hashalgorithm", "SHA");
            logRequest      = properties.getProperty("logrequest", "no").equalsIgnoreCase("yes");
            logReply        = properties.getProperty("logreply", "no").equalsIgnoreCase("yes");
            loginRequired   = properties.getProperty("loginrequired", "no").equalsIgnoreCase("yes");
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
        public int getHistoryRows() {
            return historyRows;
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
    
    private String getListSql(String table, String field, String filter) throws ParseException {
        SQLSelectBuilder sql            = new SQLSelectBuilder(table);
        String           filterFields[] = filter.split(",");
        
        sql.setOptions("DISTINCT");
        sql.addField(field);
        sql.setWhere(field + " IS NOT NULL");
        
        for (String condition : filterFields) {
            String c[] = condition.split("!");
            
            if (c.length > 2) throw new ParseException("Filter condition [" + condition + "] must be field!value", 0);
            
            if (c.length == 2 && c[1].trim().length() != 0) {
                sql.addAnd(c[0], "=", c[1]);
            }
        }
        sql.setOrderBy(field);
        
        return sql.build();
    }
    private boolean eventFor(DatabaseSession db, String timestamp) throws SQLException {
        ResultSet rs = db.executeQuery("SELECT Timestamp FROM NutritionEvent WHERE Timestamp = '" + timestamp + "'");
             
        return rs.next();
    }
    private String getWeight(DatabaseSession db, String date) throws SQLException {
        SQLSelectBuilder sql = new SQLSelectBuilder("Weight");
        
        sql.addField("Kilos");
        sql.setWhere("Date = '" + date + "'");
        
        ResultSet rs = db.updateQuery(sql.build());
                
        if (rs.next()) return rs.getString("Kilos");
        
        return "";
    }
    private void updateWeight(DatabaseSession db, String date, String time, String weight) throws SQLException {
        SQLSelectBuilder sql  = new SQLSelectBuilder("Weight");
        
        sql.addField("Date");
        sql.addField("Time");
        sql.addField("Kilos");
        
        sql.setWhere("Date = '" + date + "'");
        
        ResultSet rs = db.updateQuery(sql.build());
                
        if (rs.next()) {
            /*
             * The database date time starts at 00:00:00. Calculate the number of seconds between the database time
             * and now. If this is less than a day the current update is for the current date and in this event we apply
             * the weight update. Changes to existing weight table entried for previous days are ignored.
             */
            double seconds = (System.currentTimeMillis() - rs.getDate("Date").getTime()) / 1000.0;
            
            if (seconds < 24*60*60) {
                rs.moveToCurrentRow();
                rs.updateString("Kilos", weight);
                rs.updateRow();
            }
        } else {
            rs.moveToInsertRow();
            rs.updateString("Date",  date);
            rs.updateString("Time",  time);
            rs.updateString("Kilos", weight);
            rs.insertRow();
        } 
    }
    private void setNumericItemField(ResultSet rs, String name, String value, double scale) throws SQLException {
        
        if (value.length() == 0)
            rs.updateNull(name);
        else
            rs.updateDouble(name, Double.parseDouble(value) / scale);
    }
    private void setItemFields(ResultSet rs, HTTPRequestHandler  handler) throws SQLException {
        String  fld    = handler.getParameter("size");
        boolean simple = handler.getParameter("simple").equalsIgnoreCase("true");
        double  scale  = 1;
        
        if (fld.length() != 0) scale = Double.parseDouble(fld);
        
        rs.updateString("Item",   handler.getParameter("item"));
        rs.updateString("Source", handler.getParameter("source"));
        rs.updateString("Type",   handler.getParameter("type"));
        rs.updateString("Simple", simple? "Y" : "N");
        
        setNumericItemField(rs, "Calories",      handler.getParameter("calories"),     scale);
        setNumericItemField(rs, "Protein",       handler.getParameter("protein"),      scale);
        setNumericItemField(rs, "Cholesterol",   handler.getParameter("cholesterol"),  scale);
        setNumericItemField(rs, "Fat",           handler.getParameter("fat"),          scale);
        setNumericItemField(rs, "Saturated",     handler.getParameter("saturated"),    scale);
        setNumericItemField(rs, "Carbohydrates", handler.getParameter("carbohydrate"), scale);
        setNumericItemField(rs, "Sugar",         handler.getParameter("sugar"),        scale);
        setNumericItemField(rs, "Fibre",         handler.getParameter("fibre"),        scale);
        setNumericItemField(rs, "Salt",          handler.getParameter("salt"),         scale);
        setNumericItemField(rs, "ABV",           handler.getParameter("abv"),          1);
        
        if (simple) setNumericItemField(rs, "DefaultSize", handler.getParameter("default"), 1);
    }
    private void processAction(
            Security            security,
            DatabaseSession     db, 
            HTTPRequestHandler  handler, 
            HttpServletResponse response,
            StringBuilder       replyBuffer) throws ServletException, IOException, SQLException {
        String        action = handler.getParameter("action");
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
                handler.dumpRequest(response, "No action parameter");
            } else if (action.equals("getweight")) {
                String date   = handler.getParameter("date");
                
                replyBuffer.append(getWeight(db, date));
                response.setStatus(200);        
            } else if (action.equals("getitem")) {
                SQLSelectBuilder sql  = new SQLSelectBuilder("NutritionDetail");
                
                sql.addField("Item",          "iitem");
                sql.addField("Calories",      "icalories");
                sql.addField("Source",        "isource");
                sql.addField("Type",          "itype");
                sql.addField("Protein",       "iprotein");
                sql.addField("Cholesterol",   "icholesterol");
                sql.addField("Fat",           "ifat");
                sql.addField("Saturated",     "isaturated");
                sql.addField("Carbohydrates", "icarbohydrate");
                sql.addField("Sugar",         "isugar");
                sql.addField("Fibre",         "ifibre");
                sql.addField("Salt",          "isalt");
                sql.addField("Simple",        "isimple");
                sql.addField("ABV",           "iabv");
                sql.addField("DefaultSize",   "idefault");
                
                sql.addAnd("SeqNo", "=", handler.getParameter("seqno"));
                JSONArray  fields = new JSONArray();
                ResultSet  rs     = db.executeQuery(sql.build());
                
                fields.addFields(rs);
                fields.append(replyBuffer);
                
                response.setStatus(200);
            } else if (action.equals("applyitemupdate")) {                
                String    seqNo = handler.getParameter("seqno");
                ResultSet rs;
                
                db.startTransaction();
                
                if (seqNo.length() == 0) {
                    rs = db.insertTable("NutritionDetail");
                    rs.moveToInsertRow();
                    setItemFields(rs, handler);
                    rs.insertRow();
                    response.setStatus(200);
                } else {
                    rs = db.updateQuery("SELECT * FROM NutritionDetail WHERE SeqNo = " + seqNo);
                    
                    if (!rs.next())
                        replyBuffer.append("No record for SeqNo " + seqNo);
                    else {
                        rs.moveToCurrentRow();
                        setItemFields(rs, handler);
                        rs.updateRow();
                        response.setStatus(200);
                    }
                }
                rs.close();
                db.commit();
            } else if (action.equals("eventhistory")) {
                JSONObject       data = new JSONObject();
                SQLSelectBuilder sql  = new SQLSelectBuilder("NutritionEventSummary");

                sql.setProtocol(db.getProtocol());
                sql.setMaxRows(config.getHistoryRows());
                
                sql.addField("Timestamp");
                sql.addField("Weekday");
                sql.addDefaultedField("Description", "");
                sql.addDefaultedField("Comment",     "");
                sql.addField("Calories");
                sql.addField("Protein");
                sql.addField("Fat");
                sql.addField("Saturated");
                sql.addField("Carbohydrate", "Carb");
                sql.addField("Sugar");
                sql.addField("Fibre");
                sql.addField("Salt");
                sql.addField("Units");
                sql.setOrderBy("Timestamp DESC");
               
                sql.addAnd("WeekDay",     "=",    handler.getParameter("day"));
                sql.addAnd("Description", "LIKE", handler.getParameter("description"));
                
                ResultSet rs = db.executeQuery(sql.build());
                data.add("EventHistory", rs);
                data.append(replyBuffer);
                
                response.setStatus(200);
            } else if (action.equals("requestdetails")) {                
                JSONObject       data   = new JSONObject();
                String           source = handler.getParameter("source");
                String           type   = handler.getParameter("type");
                String           item   = handler.getParameter("item");
                SQLSelectBuilder sql    = new SQLSelectBuilder("NutritionDetail");
                
                sql.addField("SeqNo");
                sql.addField("Item");
                sql.addDefaultedField("ABV",         0);
                sql.addDefaultedField("Source",      "");
                sql.addDefaultedField("Type",        "");
                sql.addDefaultedField("Simple",      "");
                sql.addDefaultedField("DefaultSize", 0);
                sql.addDefaultedField("Salt",        0);
                sql.addDefaultedField("Calories",    0, 2);
                sql.setOrderBy("Item");
                
                sql.addAnd("source", "=",    source);
                sql.addAnd("type",   "=",    type);
                sql.addAnd("item",   "LIKE", item);
                
                ResultSet rs = db.executeQuery(sql.build());
                data.add("ItemDetails", rs);
                data.append(replyBuffer);
                response.setStatus(200);
            } else if (action.equals("getList")) {
                JSONObject data  = new JSONObject();
                String     field = handler.getParameter("name");                           
                ResultSet  rs    = db.executeQuery(getListSql("NutritionDetail", field, handler.getParameter("filter")));
                
                data.add(field, rs);
                data.append(replyBuffer);

                response.setStatus(200);
            } else if (action.equals("createevent")) {
                String timestamp   = handler.getParameter("crdate") + ' ' + handler.getParameter("crtime");
                String description = handler.getParameter("crdescription");                
                String comment     = handler.getParameter("crcomment");               
                String weight      = handler.getParameter("crweight");
                
                if (eventFor(db, timestamp))
                    replyBuffer.append("Change time as event already recorded for " + timestamp);
                else {
                    SQLInsertBuilder sql = new SQLInsertBuilder("NutritionEvent");
                    
                    sql.addField("Timestamp",   timestamp);
                    sql.addField("Description", description);
                    sql.addField("Comment",     comment);
                    db.executeUpdate(sql.build());
                }
                updateWeight(db, handler.getParameter("crdate"), handler.getParameter("crtime"), weight);
                response.setStatus(200);
            } else if (action.equals("updateevent")) {
                String timestamp   = handler.getParameter("date") + ' ' + handler.getParameter("time");
                String description = handler.getParameter("description");
                String comment     = handler.getParameter("comment");
                
                SQLUpdateBuilder sql = new SQLUpdateBuilder("NutritionEvent");
                    
                sql.addField("Description", description);
                sql.addField("Comment",     comment);
                sql.setWhere("Timestamp = '" + timestamp + "'");
                db.executeUpdate(sql.build());
                response.setStatus(200);
            } else if (action.equals("copyevent")) {
                String sTimestamp   = handler.getParameter("sdate") + ' ' + handler.getParameter("stime");
                String cTimestamp   = handler.getParameter("cdate") + ' ' + handler.getParameter("ctime");
                String cDescription = handler.getParameter("cdescription");
                String cComment     = handler.getParameter("ccomment");
                
                if (eventFor(db, cTimestamp))
                    replyBuffer.append("Change time as event already recorded for " + cTimestamp);
                else {
                    SQLInsertBuilder sql = new SQLInsertBuilder("NutritionEvent");
                    
                    sql.addField("Timestamp",   cTimestamp);
                    sql.addField("Description", cDescription);
                    sql.addField("Comment",     cComment);
                    db.executeUpdate(sql.build());
                    db.executeUpdate(
                        "INSERT NutritionRecord " +
                        "SELECT '" + cTimestamp   + "', Detail, Quantity, ABV " +
                        "FROM   NutritionRecord " +
                        "WHERE Timestamp = ' "    + sTimestamp + "'");
                }
                updateWeight(db, handler.getParameter("cdate"), handler.getParameter("ctime"), handler.getParameter("cweight"));
                response.setStatus(200);
            } else if (action.equals("deleteevent")) {
                String timestamp = handler.getParameter("date") + ' ' + handler.getParameter("time");
                
                db.executeUpdate("DELETE FROM NutritionRecord WHERE Timestamp = '" + timestamp + "'");
                db.executeUpdate("DELETE FROM NutritionEvent  WHERE Timestamp = '" + timestamp + "'");
                
                response.setStatus(200);
            } else if (action.equals("deleteitem")) {
                String    seqNo       = handler.getParameter("seqno");
                String    timestamp   = handler.getParameter("date") + ' ' + handler.getParameter("time");
                
                StringBuilder sql = new StringBuilder();
                
                sql.append("DELETE FROM NutritionRecord WHERE Timestamp = '" + timestamp + "' AND Detail = " + seqNo);
                db.executeUpdate(sql.toString());
                
                response.setStatus(200);
            } else if (action.equals("modifyitem")) {
                String    seqNo       = handler.getParameter("seqno");
                String    timestamp   = handler.getParameter("date") + ' ' + handler.getParameter("time");
                String    description = handler.getParameter("description");
                String    quantity    = handler.getParameter("quantity");
                String    abv         = handler.getParameter("abv");
                
                SQLSelectBuilder sql       = new SQLSelectBuilder("NutritionEvent");
                
                sql.addField("Timestamp");
                sql.addField("Description");
                sql.setWhere("Timestamp = '" + timestamp + "'");
                
                ResultSet rs = db.updateQuery(sql.build());
                
                if (rs.next()) {
                    rs.moveToCurrentRow();
                    rs.updateString("Description", description);
                    rs.updateRow();
                } else {
                    rs.moveToInsertRow();
                    rs.updateString("Timestamp", timestamp);
                    rs.updateString("Description", description);
                    rs.insertRow();
                }
                sql.clear();
                sql.setFrom("NutritionRecord");
                sql.addField("Timestamp");
                sql.addField("Detail");
                sql.addField("Quantity");
                sql.addField("ABV");
                sql.addAnd("Timestamp", "=", timestamp);
                sql.addAnd("Detail",    "=", seqNo);
                
                rs = db.updateQuery(sql.build());
                
                if (rs.next()) {
                    rs.moveToCurrentRow();
                    rs.updateString("Quantity", quantity);
                    
                    if (abv.length() != 0) rs.updateString("ABV", abv);
                    
                    rs.updateRow();
                } else {
                    rs.moveToInsertRow();
                    rs.updateString("Timestamp", timestamp);
                    rs.updateString("Detail",    seqNo);
                    rs.updateString("Quantity",  quantity);
                    
                    if (abv.length() != 0) rs.updateString("ABV", abv);
                    rs.insertRow();                    

                }
                response.setStatus(200);
            } else if (action.equals("getactiveevent")) {    
                JSONObject       data      = new JSONObject();
                String           timestamp = handler.getParameter("date") + ' ' + handler.getParameter("time");
                SQLSelectBuilder sql       = new SQLSelectBuilder();
                
                sql.addField("ND.SeqNo", "SeqNo");
                sql.addField("ND.Item",  "Item");
                sql.addDefaultedField("NR.ABV",                "ABV",      0);
                sql.addDefaultedField("NR.Quantity",           "Quantity", 0);
                sql.addDefaultedField("ND.Source",             "Source",   "");
                sql.addDefaultedField("ND.Type",               "Type",     "");
                sql.addDefaultedField("ND.Simple",             "Simple",   "");
                sql.addDefaultedField("NR.Quantity * ND.Salt", "Salt",     0, 3);
                sql.setOrderBy("ND.Item");
                
                sql.setFrom("NutritionRecord NR JOIN NutritionDetail ND ON NR.Detail = ND.SeqNo");
                sql.setWhere("NR.Timestamp = '" + timestamp + "'");
                
                ResultSet rs = db.executeQuery(sql.build());
                data.add("ItemDetails", rs);
                data.append(replyBuffer);
                
                response.setStatus(200);
            } else if (action.equals("checktimestamp")) {
                String    timestamp = handler.getParameter("date") + ' ' + handler.getParameter("time");
                
                if (eventFor(db, timestamp)) {
                    replyBuffer.append("Change time as event already recorded for " + timestamp);
                }  
                response.setStatus(200);
            } else {
                handler.dumpRequest(response, "Action " + action + " is invalid");
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
            
        DatabaseSession    db          = new DatabaseSession();
        HTTPRequestHandler handler     = new HTTPRequestHandler(request);
        String             action      = handler.getParameter("action");
        StringBuilder      replyBuffer = new StringBuilder();
        boolean            useMySql    = handler.getParameter("mysql").equalsIgnoreCase("true");
        int                maxRepeats  = 5;
        int                repeat      = 0;
           
        try {
            Report.comment(null, "processRequest called with action " + action + " sessionId " + handler.getCookie("sessionid") + " mysql " + useMySql + " default " + System.getProperty("user.dir"));
            
            if (config.isOpenShift())   useMySql = true;
            
            t.report('C', "action " + action + " server " + config.getDbServer() + " database " + config.getDatabase() + " user " + config.getDbUser());

            if (useMySql)
                db.open("mysql", "com.mysql.jdbc.Driver", config.getDbServer(), config.getDatabase(), config.getDbUser(), config.getDbPassword());
            else
                db.open(config.getDbServer(), config.getDatabase(), config.getDbUser(), config.getDbPassword());
            
            Security security = new Security(db, request, config);
            
            while (repeat <= maxRepeats) {
                try {
                    security.checkSession(repeat);
                    processAction(security, db, handler, response, replyBuffer);
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
        
        if (config.getLogReply()) Report.comment(null, replyBuffer.toString());
        
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
