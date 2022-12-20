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
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.cbc.application.reporting.Measurement;
import org.cbc.application.reporting.Process;
import org.cbc.application.reporting.Report;
import org.cbc.application.reporting.Thread;
import org.cbc.application.reporting.Trace;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.json.JSONValue;
import org.cbc.sql.SQLBuilder;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLNamedValues;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;
import org.cbc.utils.system.Environment;
import org.cbc.utils.system.SecurityConfiguration;

/**
 *k
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public abstract class ApplicationServer extends HttpServlet {
    public class ErrorExit extends RuntimeException {
        
    }
    public void checkExit(Context ctx, boolean test, String message) throws ErrorExit {
        if (test) {
            ctx.getReplyBuffer().append(message);
            ctx.setStatus(200);
            throw new ErrorExit();
        }
    }
    protected Reminder reminder = null;
    /*
     * Describes a table field.
     */
    protected class DBField {
        String  name;         // DB Table field name.
        String  parameter;    // Parameter name providing the field.
        boolean key;          // Forms part of the primary key
        boolean blankToNull;
        boolean isDate;
        
        public DBField(String name, boolean key, String parameter) {
            this.name        = name;
            this.key         = key;
            this.parameter   = parameter;
            this.blankToNull = false;
            this.isDate      = false;
        }
        public DBField(String name, boolean key, String parameter, boolean blankToNull, boolean isDateTime) {
            this.name        = name;
            this.key         = key;
            this.parameter   = parameter;
            this.blankToNull = blankToNull;
            this.isDate      = isDateTime;
        }
    }
    protected String getListSql(Context ctx, String table, String field) throws ParseException, SQLException {
        SQLSelectBuilder sql = ctx.getSelectBuilder(table);
        
        sql.setOptions("DISTINCT");
        sql.addField(field);
        sql.setWhere(field + " IS NOT NULL");
        sql.addAnd( ctx.getParameter("filter"));
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
    protected void getTableDefinition(Context ctx) throws SQLException, ParseException, JSONException {
        DatabaseSession.TableDefinition table = ctx.getAppDb().new TableDefinition(ctx.getParameter("table"));
        
        table.getColumn("Modified").setDisplay(false);
        table.toJson(true).append(ctx.getReplyBuffer());
        ctx.setStatus(200);
    }
    public static long getPID() {
        String processName
                = java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
        return Long.parseLong(processName.split("@")[0]);
    }
    protected class Configuration implements SecurityConfiguration {  
        Properties  properties = new Properties();  
        Environment props      = new Environment(properties);
        Environment envs       = new Environment();
        
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
            protected Login reminder    = new Login();
            
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
            public void setReminder(String name, String user, String password) {
                Trace t = new Trace("setReminder");
                
                if (name     == null) name     = config.getProperty("remdatabase");                
                if (user     == null) user     = config.getProperty("remuser");              
                if (password == null) password = config.getProperty("rempassword");

                t.report('C', "Database " + name + " user " + user);
                reminder.load(name, user, password);
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
        private double  longStatementTime;
        private boolean measureSQL;
        private boolean sqlServerAvailable;
        private boolean sshRequired;
   
        public String getProperty(String name) {
            return props.getValue(name);
        }
        public int getIntProperty(String name, int defaultValue) {
            return props.getIntValue(name, defaultValue);
        }        
        public void load(ServletConfig config) throws IOException {
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            dbServer           = envs.getValue("DATABASE_SERVER", "127.0.0.1");
            mysqlUseSSL        = envs.getValue("DATABASE_USE_SSL", "");
            logRequest         = envs.getBooleanValue("LOG_HTML_REQUEST");
            logReply           = envs.getBooleanValue("LOG_HTML_REPLY");
            longStatementTime  = envs.getDoubleValue("LONG_STATEMENT_TIME", 0);
            measureSQL         = envs.getBooleanValue("MEASURE_SQL_QUERY");
            sqlServerAvailable = envs.getBooleanValue("SQLSERVER_AVAILABLE");
            sshRequired        = envs.getBooleanValue("SSH_REQUIRED");
            appName            = config.getServletName();
            deadlockRetries    = props.getValue("deadlockretries");
            hashAlgorithm      = props.getValue("hashalgorithm", "SHA");
            loginRequired      = props.getValue("loginrequired", "no").equalsIgnoreCase("yes");
            
            if (envs.getValue("DATABASE_PORT") != null) {
                dbServer += ":" + envs.getValue("DATABASE_PORT");
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
        public double getLongStatementTime() {
            return longStatementTime;
        }
    }
    protected Configuration config = new Configuration();
    
    protected class Context {
        private DatabaseSession     appDb = null;
        private DatabaseSession     secDb = null;
        private DatabaseSession     remDb = null;
        private HTTPRequestHandler  handler;
        private HttpServletResponse response;
        private StringBuilder       replyBuffer;
        
        public void addAnd(SQLBuilder sql, String field, String operator, String paramName) {
            String value = getParameter(paramName);
            
            if (value.trim().length() != 0) sql.addAnd(field, operator, value);
        }
        public String getTimestamp(Date date, String format) { 
            return date == null? null : (new SimpleDateFormat(format)).format(date);
        }
        public String getDbTimestamp(Date date) {
            return date == null? null : DatabaseSession.getDateTimeString(date, appDb.getProtocol());
        }
        public String getDbDate(Date date) {
            return date == null? null : DatabaseSession.getDateString(date, appDb.getProtocol());
        }
        public String getDbTime(Date date) { 
            return date == null? null : DatabaseSession.getTimeString(date);
        }
        public java.sql.Timestamp getSQLTimestamp(Date date) {
            return date == null? null : new java.sql.Timestamp(date.getTime());
        }        
        public void close() {
            if (appDb != null) appDb.close();
            if (secDb != null) secDb.close();
            if (remDb != null) remDb.close();
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
            session.SetLongStatementTime(config.getLongStatementTime());
            
            t.exit();
            
            return session;
        }
        public DatabaseSession getAppDb() {
            return appDb;
        }
        public DatabaseSession getSecDb() {
            return secDb == null? appDb : secDb;
        }
        public DatabaseSession getRemDb() {
            return remDb;
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
        public String[] getParameters(String name) {
            return handler.getRequest().getParameterValues(name);
        }
        public int getInt(String name, int nullDefault) {
            String value = handler.getParameter(name);
            
            if (value == null) return nullDefault;
            
            return Integer.parseInt(value);
        }
        public double getDouble(String name, int nullDefault) {
            String value = handler.getParameter(name);
            
            if (value == null) return nullDefault;
            
            return Double.parseDouble(value);
        }        
        public boolean existsParameter(String name) {
            return handler.existsParameter(name);
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
            
            if (!config.databases.application.equals(config.databases.reminder))
                remDb = openDatabase(config.databases.reminder, useMySql);
            else
                remDb = appDb;
        }
        public SQLSelectBuilder getSelectBuilder(String table) {
            SQLSelectBuilder builder = new SQLSelectBuilder(table, appDb.getProtocol());
            
            return builder;
        }
        public SQLUpdateBuilder getUpdateBuilder(String table) {
            SQLUpdateBuilder builder = new SQLUpdateBuilder(table, appDb.getProtocol());
            
            return builder;
        }
        public SQLInsertBuilder getInsertBuilder(String table) {
            SQLInsertBuilder builder = new SQLInsertBuilder(table, appDb.getProtocol());
                        
            return builder;
        }
        public SQLDeleteBuilder getDeleteBuilder(String table) {
            SQLDeleteBuilder builder = new SQLDeleteBuilder(table, appDb.getProtocol());
            
            return builder;
        }
    }
    protected class TableReader {     
        private ResultSet rs        = null;
        private boolean   rowExists = false;
        
        public void close() throws SQLException {
            if (rs != null) rs.close();
            
            rowExists = false;            
        }
        public void open(Context ctx, SQLSelectBuilder sql) throws SQLException {
            close();
            rs = executeQuery(ctx, sql);
            rowExists = rs.first();            
        }
        public void first() throws SQLException {
            rowExists = rs.first();            
        }
        public boolean next() throws SQLException {
            rowExists = rs.next();
            return rowExists;
        }
        public boolean rowExists() {
            return this.rowExists;
        }
        public boolean lastValueNull() throws SQLException {
            return rs.wasNull();
        }
        public double getDouble(String colName) throws SQLException {
            double val = rs.getDouble(colName);
            
            return rs.wasNull()? -1 : val;
        }
        public int getInt(String colName) throws SQLException {
            int val = rs.getInt(colName);
            
            return rs.wasNull()? -1 : val;
        }
        public Date getDate(String colName) throws SQLException {
            Date val = rs.getTimestamp(colName);
            
            return val;            
        }
    }
    protected class TableUpdater {
        private final String             name;
        private final ArrayList<DBField> fields = new ArrayList<>();
        private Context            ctx;
        private ResultSet          rs;
        private String             keyString;
        
        private void appendKeyString(String field, String value) throws SQLException {
            if (value != null && !"".equals(value)) {
                if (!"".equals(keyString)) keyString += ", ";
                
                keyString += field + " = " + value;
            } else {
                throw new SQLException("Table " + name + " key field " + field + " is null");
            }
        }
        private void addKey(SQLBuilder sql, Context ctx, String keySource) throws ParseException, SQLException {
            HashMap<String, String> overrides = new HashMap<>();
            
            for(String str: keySource.split(",")) {
                String flds[] = str.split("-");
                
                if (flds.length == 2) overrides.put(flds[0], flds[1]);
            }
            keyString = "";
            
            for(DBField field : fields) {
                String value = "";
                
                if (field.key) {
                    String keyParam = overrides.containsKey(field.name)? overrides.get(field.name) : field.parameter;
                    
                    if (field.isDate) {
                        Date ts = ctx.getTimestamp(keyParam);                        
                        sql.addAnd(field.name, "=",ts );
                        value = ctx.getDbTimestamp(ts);
                    } else {
                        value = ctx.getParameter(keyParam);
                        sql.addAnd(field.name, "=", value);
                    }
                    appendKeyString(field.name, value);
                }
            }
        }    
        private void setFields(ResultSet rs, Context ctx) throws SQLException, ParseException {
            for(DBField field : fields) {
                if (field.isDate)
                    rs.updateString(field.name, ctx.getDbTimestamp(ctx.getTimestamp(field.parameter)));
                else
                {
                    String value = ctx.getParameter(field.parameter);
                    
                    if (value.trim().equals("") && field.blankToNull) value = null;
                    
                    rs.updateString(field.name, value);
                }
            }            
        }
        private void update(String action, String keyOverride) throws ParseException, SQLException {
            /*
             * Attempt to retrieve a session for the primary key.
             */
            SQLSelectBuilder sql = ctx.getSelectBuilder(name);
            addKey(sql, ctx, keyOverride);
           
            rs = ctx.getAppDb().updateQuery(sql.build());

            if (rs.next()) {
                switch (action) {
                    case "create":
                        ctx.getReplyBuffer().append(name).append(" row already exists for ").append(keyString);
                        break;
                    case "update":
                        rs.moveToCurrentRow();
                        setFields(rs, ctx);
                        rs.updateRow();
                        ctx.setStatus(200);
                        break;
                    case "delete":
                        rs.moveToCurrentRow();
                        rs.deleteRow();
                        ctx.setStatus(200);
                        break;
                    default:
                        throw new IllegalArgumentException("Action: " + action + " for TableUpdater.update");
                }
            } else {
                switch (action) {
                    case "create":
                        rs.moveToInsertRow();
                        setFields(rs, ctx);
                        rs.insertRow();
                        ctx.setStatus(200);
                        break;
                    case "update":
                    case "delete":
                        ctx.getReplyBuffer().append("No " + name + " row for " + keyString);
                        break;
                    default:
                        throw new IllegalArgumentException("Action: " + action + " for TableUpdater.update");
                }
            }     
        }
        private void update(String action) throws ParseException, SQLException {
            update(action, "");
        }
        public void setContext(Context context) {
            ctx = context;
        }
        public TableUpdater(String tableName) {
            name = tableName;
        }
        public void addField(String name, boolean key, String parameter) {
            fields.add(new DBField(name, key, parameter));
        }
        public void addField(String name, boolean key, String parameter, boolean blankToNull, boolean isDateTime) {
            fields.add(new DBField(name, key, parameter, blankToNull, isDateTime));
        }
        public void addField(String name, boolean key, String parameter, boolean blankToNull) {
            fields.add(new DBField(name, key, parameter, blankToNull, false));
        }
        public void createRow() throws ParseException, SQLException {
            update("create");
        }
        public void updateRow(String keyOverride) throws ParseException, SQLException {
            update("update", keyOverride);
        }
        public void updateRow() throws ParseException, SQLException {
            update("update");
        }
        public void deleteRow() throws ParseException, SQLException {
            update("delete");
        }
        public void addOrderBy(SQLSelectBuilder sql, boolean desc) {
            for(DBField field : fields) {
                if (field.key) sql.addOrderByField(field.name, desc);
            }
        }
        public void addFilter(SQLSelectBuilder sql) throws SQLException {            
            if (ctx.existsParameter("filter")) sql.addAnd(ctx.getParameter("filter"));            
        }
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
    /*
     * This creates a result set that allows reposition to the start. 
     *
     * In the interest of efficiency should also allow the creation of a forward only result set
     */
    protected ResultSet executeQuery(Context ctx, String sql) throws SQLException {
        measureSQL.start();
        ResultSet rs = ctx.getAppDb().executeQuery(sql, ResultSet.TYPE_SCROLL_SENSITIVE);
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
    protected ResultSet updateQuery(Context ctx, SQLBuilder sql) throws SQLException {
        return updateQuery(ctx, sql.build());
    }
    protected int executeUpdate(Context ctx, String sql) throws SQLException {
        measureSQL.start();
        int cnt = ctx.getAppDb().executeUpdate(sql);
        measureSQL.end(sql);
        return cnt;
    }
    protected ResultSet executeUpdateGetKey(Context ctx, SQLBuilder sql) throws SQLException {
        ResultSet rs;
        String    sqls = sql.build();
        
        measureSQL.start();
        rs = ctx.getAppDb().executeUpdateGetKey(sqls);
        measureSQL.end(sqls);
        
        return rs;
    }
    protected int executeUpdate(Context ctx, SQLBuilder sql) throws SQLException {
        return executeUpdate(ctx, sql.build());
    }
    protected boolean exists(Context ctx, String table, SQLNamedValues where) throws SQLException {
        ResultSet        rs;
        SQLSelectBuilder sel = new SQLSelectBuilder(table, ctx.getAppDb().getProtocol());
        
        sel.addField("Count", "1");
        sel.addAnd(where);
        rs = ctx.getAppDb().executeQuery(sel.build());
        
        return rs.next();
    }
    public abstract String getVersion();
    public abstract void initApplication (ServletConfig config, Configuration.Databases databases) throws ServletException, IOException;
    public abstract void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException;
    
    private void setKeyMessage(Context ctx, String prefix, String table, String key) {
        ctx.getReplyBuffer().append('!').append(prefix).append('!').append(table).append('!').append(key);
    }
    protected void updateTable(Context ctx) throws JSONException, ParseException, SQLException {
        String     fields[]  = ctx.getParameter("table").split(",");
        String     table     = fields[0];
        String     action    = fields.length == 1 ? "Update" : fields[1];
        String     columns[] = ctx.getParameters("column");
        String     name;
        String     value;
        String     type;
        String     pKey      = "";
        boolean    isPKey;
        ResultSet  rs;
        
        SQLBuilder sql = null;
        
        switch (action) {
            case "Read":
                sql = new SQLSelectBuilder(table, ctx.appDb.getProtocol());
                break;
            case "Create":
                sql = new SQLInsertBuilder(table, ctx.appDb.getProtocol());
                break;
            case "Update":
                sql = new SQLUpdateBuilder(table, ctx.appDb.getProtocol());
                break;
            case "Delete":
                sql = new SQLDeleteBuilder(table, ctx.appDb.getProtocol());
                break;
        }
        for (String col: columns) {
            fields = col.split(",");
            name   = fields[0];
            value  = fields[1];
            type   = fields[2];
            isPKey = fields[3].equalsIgnoreCase("true");
            
            if (isPKey) {
                if (pKey.length() != 0) pKey += ", ";
                
                pKey += name + "=" +value;
            }
            switch (action) {
                case "Create":
                    sql.addField(name, value, type);
                    break;
                case "Update":
                    if (!isPKey) sql.addField(name, value, type);
                    break;
                case "Read":
                    ((SQLSelectBuilder)sql).addField(name);
                    break;
                case "Delete":
                    // Only where clause required for delete.
            }
            if (!action.equals("Create") && isPKey) sql.addAnd(name, "=", value, type);
        }
        switch (action) {
            case "Read":           
                JSONObject data = new JSONObject();

                rs = executeQuery(ctx, sql);
                data.add("TableRow", rs);

                if (data.get("Data").getArray().size() == 0)
                    setKeyMessage(ctx, "Not found", table, pKey);
                else
                    data.append(ctx.getReplyBuffer());
                break;
            case "Update":
            case "Delete":      
                int cnt = executeUpdate(ctx, sql);
                
                if (cnt == 0) setKeyMessage(ctx, "Not found",  table, pKey);
                
                break;
            case "Create":
                try {
                    executeUpdate(ctx, sql);
                } catch (SQLException ex) {
                    if (ex.getMessage().startsWith("Duplicate"))
                        setKeyMessage(ctx, "Already exists",  table, pKey);
                    else
                        throw ex;
                }
                break;
            default:
                Report.error("", "Action " + action + " not valid");
        }
        ctx.setStatus(200);
    }
    private void addRowColumn(JSONArray row, String colName) throws JSONException {
        JSONObject col = new JSONObject();
        
        col.add("Type", "varchar");
        col.add("Name", colName);
        row.add(col);
    }
    private void debugAction(Context ctx) throws JSONException {
        String              request = ctx.getParameter("request");
        JSONObject          data    = new JSONObject();
        JSONArray           row     = new JSONArray();
        JSONArray           rows;
        int                 max = -1;
        String              value;
    
        ctx.handler.dumpRequest();
        data.add("Table", "Debug");
        data.add("Header", row);
        
        if (ctx.existsParameter("maxfield") && ctx.getParameter("maxfield").length() != 0) {
            max = Integer.parseInt(ctx.getParameter("maxfield"));
        }
        if (request.equals("Show Env")) {
            Map<String, String> envs = new TreeMap<>(System.getenv());
            
            addRowColumn(row, "Variable");
            addRowColumn(row, "Value");
            rows = new JSONArray();
            data.add("Data", rows);

            for (String key : envs.keySet()) {
                value = envs.get(key);
                
                if (max == -1 || value.length() <= max) {
                    row = new JSONArray();
                    rows.add(row);
                    row.add(new JSONValue(key));
                    row.add(new JSONValue(value));
                }
            }
        } else if (request.equals("Report Streams")) {
            HashMap<String, Process.Stream.Summary> streams = Process.getProcess(config.getAppName()).getStreamSummaries();
            
            addRowColumn(row, "Stream");
            addRowColumn(row, "File");
            addRowColumn(row, "FullFile");
            addRowColumn(row, "Prefix");
            rows = new JSONArray();
            data.add("Data", rows);
            
            streams.entrySet().forEach((stream) -> {
                Process.Stream.Summary smy = stream.getValue();
                
                JSONArray r = new JSONArray();
                rows.add(r);
                r.add(new JSONValue(smy.getName()));
                r.add(new JSONValue(smy.getFileName()));
                r.add(new JSONValue(smy.getFullFilename()));
                r.add(new JSONValue(smy.getReportPrefix()));
            });
        }
        data.append(ctx.getReplyBuffer());
        ctx.setStatus(200);                       
    }
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
            } else if (action.equals("updatetable")) {
                updateTable(ctx);        
            } else if (action.equals("debug")) {
                debugAction(ctx);
            } else if (action.equals("")) {
                ctx.getHandler().dumpRequest("No action parameter"); 
            } else {                
                if (!config.getAppName().equals("Reminder")) {
                    Reminder.State state = reminder.alert();
                    
                    if (state.alerts()) {
                        ctx.getReplyBuffer().append(state.getImmediate() != 0? "!ReminderImmediate" : "!ReminderAlert");
                        ctx.getReplyBuffer().append(',');
                        ctx.getReplyBuffer().append(state.getAlertFrequency());
                        ctx.getReplyBuffer().append(',');
                        ctx.getReplyBuffer().append(ctx.getTimestamp(state.getEarliest(), "yyyy-MM-dd HH:mm"));
                        ctx.getReplyBuffer().append(';');                        
                    }
                }
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
            if (this.config.databases.reminder.name == null) {
                this.config.databases.setReminder(null, null, null);
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
            
            Security security = new Security(ctx.getSecDb(), ctx.handler, config);
            
            if (reminder == null) {
                reminder = new Reminder(ctx.getRemDb());                
                reminder.setAlertOptions(
                        this.config.getIntProperty("reminderalertrepeat",    0),
                        this.config.getIntProperty("reminderalertimmediate", 1));
            } else
                reminder.changeDatabase(ctx.getRemDb());
            
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
        } catch (ErrorExit ex) {
            t.report('C', "ErrorExit");            
        }
        if (repeat != 0) t.report('C', "Deadlock count " + repeat);
        
        t.report('C', "Starting response");
        response.getWriter().println(ctx.getReplyBuffer().toString());
        t.report('C', "Response added");
        
        if (response.getStatus() != 200) t.report('C', ctx.getReplyBuffer().toString());
        
        if (config.getLogReply()) Report.comment(null, ctx.getReplyBuffer().toString());
        
        ctx.close();
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
