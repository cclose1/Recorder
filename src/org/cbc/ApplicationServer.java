/*
 * This package is responsible for handling the HTML request and response. Some requests are handled entirely
 * by the package and the others are passed to sub class override of the abstract processAction. The
 * subclasses can also override the methods that such as getList that are handled by this package.
 *
 * Note: There is a problem with the response method setStatus. This can ignore the setStatus, i.e. it does not
 *       replace the current value with the new one. This seems to occur after writing to the response using
 *       the response getWriter() method. Don't see any documentation that says this should happen.
 *       Could be a bug specific to Tomcat.
 *
 *       The package executes setStatus(200) at various points. This is redundant as this is the default value. May
 *       be better to remove these, to avoid the danger that it overrides an error status code setting.
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
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.Cookie;
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
import org.cbc.sql.SQLValue;
import org.cbc.utils.data.DatabaseSession;
import org.cbc.utils.system.DateFormatter;
import org.cbc.utils.system.Environment;
import org.cbc.utils.system.SecurityConfiguration;

/**
 * k
 *
 * @author Chris
 */
@WebServlet(name = "RecordNutrition", urlPatterns = {"/RecordNutrition"})
public abstract class ApplicationServer extends HttpServlet {

    public enum Severity {
        Validation, Error, ApplicationError
    };

    public class ErrorExit extends RuntimeException {

        String message = null;
        Severity severity = Severity.Validation;

        public ErrorExit(String message) {
            super(message);
        }

        public ErrorExit(String message, Severity severity) {
            super(message);
            this.severity = severity;
        }

        public Severity getSeverity() {
            return severity;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public String getMessage() {
            return message == null ? super.getMessage() : message;
        }

        public int getStatus() {
            switch (severity) {
                case Validation:
                    return 400;
                case Error:
                    return 410;
                case ApplicationError:
                    return 415;
            }
            return -1;
        }
    }

    public void errorExit(String message) {
        throw new ErrorExit(message);
    }

    public void invalidAction() {
        throw new ErrorExit("ActionError", Severity.ApplicationError);
    }

    public void checkExit(boolean test, String message) throws ErrorExit {
        if (test) {
            throw new ErrorExit(message);
        }
    }
    protected Reminder reminder = null;

    /*
     * Describes a table field.
     */
    protected class DBField {

        String name;         // DB Table field name.
        String parameter;    // Parameter name providing the field.
        boolean key;          // Forms part of the primary key
        boolean blankToNull;
        boolean isDate;

        public DBField(String name, boolean key, String parameter) {
            this.name = name;
            this.key = key;
            this.parameter = parameter;
            this.blankToNull = false;
            this.isDate = false;
        }

        public DBField(String name, boolean key, String parameter, boolean blankToNull, boolean isDateTime) {
            this.name = name;
            this.key = key;
            this.parameter = parameter;
            this.blankToNull = blankToNull;
            this.isDate = isDateTime;
        }
    }

    protected String getListSql(Context ctx, String table, String field) throws ParseException, SQLException {
        SQLSelectBuilder sql = ctx.getSelectBuilder(table);

        sql.setOptions("DISTINCT");
        sql.addField(field);
        sql.setWhere(field + " IS NOT NULL");
        sql.addAnd(ctx.getParameter("filter"));
        sql.setOrderBy(field);

        return sql.build();
    }

    protected void getList(Context ctx, String table, String field) throws SQLException, ParseException, JSONException {
        JSONObject data = new JSONObject();
        ResultSet rs = executeQuery(ctx, getListSql(ctx, table, field));

        data.add(field, rs);
        data.append(ctx.getReplyBuffer());

        ctx.setStatus(200);
    }

    protected void getList(Context ctx) throws SQLException, ParseException, JSONException {
        String table = ctx.getParameter("table");
        String field = ctx.getParameter("field");

        getList(ctx, table, field);
    }
    protected void changeTableRow(Context ctx, String tableName, String action) throws SQLException, ParseException {
        SQLBuilder sql;

        boolean delete                            = true;
        boolean keyRequired                       = true;
        DatabaseSession.TableDefinition table     = ctx.getAppDb().new TableDefinition(tableName);
        ArrayList<DatabaseSession.Column> columns = table.getColumns();

        switch (action) {
            case "deleteTableRow":
                delete = true;
                sql = ctx.getDeleteBuilder(tableName);
                break;
            case "updateTableRow":
                delete = false;
                sql = ctx.getUpdateBuilder(tableName);
                break;
            case "createTableRow":
                delete = false;
                keyRequired = false;
                sql = ctx.getInsertBuilder(tableName);
                break;
            default:
                sql = new SQLDeleteBuilder("", ""); // Prevent null derefencing warnings 
                throw new ErrorExit("Action " + action + " is not a table action", Severity.ApplicationError);
        }
        for (DatabaseSession.Column col : columns) {
            if (col.isPrimeKeyColumn() && keyRequired) {
                String keyParam = col.getName();

                if (ctx.existsParameter("Key~" + col.getName())) {
                    keyParam = "Key~" + col.getName();
                } else if (!ctx.existsParameter(keyParam)) {
                    throw new ErrorExit("Key column " + keyParam + " is not a parameter", Severity.ApplicationError);
                }
                sql.addAnd(col.getName(), "=", ctx.getParameter(keyParam), col.getTypeName());
            }
            if (!delete) {
                sql.addField(col.getName(), ctx.getParameter(col.getName()), col.getTypeName());
            }
        }
        executeUpdate(ctx, sql.build());
    }
    /*
     * Called to perform any application specific actions, typically validation checks, before the table update.
     * The application class overrides this if it needs to perform specific actions. If it encounters a problem, it
     * should call errorExit to rollback any database transaction and provide a user error report.
     */
    protected void preChangeTableRow(Context ctx, String tableName, String action) throws SQLException, ParseException {        
    }
    /*
     * Similar to the above except it called following the table row change and it would typically be called
     * to perform and additional database updates.
    */
    protected void postChangeTableRow(Context ctx, String tableName, String action) throws SQLException, ParseException {        
    }
    protected void changeTableRow(Context ctx) throws SQLException, ParseException {
        String tableName = ctx.getParameter("table");
        String action    = ctx.getParameter("action");
        
        preChangeTableRow(ctx,  tableName, action);
        changeTableRow(ctx,     tableName, action);
        postChangeTableRow(ctx, tableName, action);
    }

    protected void updateTableDefinition(Context ctx, DatabaseSession.TableDefinition table) throws SQLException {
        /*
         * No action required as a sub class can override this to update the table with
         * application relevant changes.
         */
    }

    protected void getTableDefinition(Context ctx) throws SQLException, ParseException, JSONException {
        DatabaseSession.TableDefinition table = ctx.getAppDb().new TableDefinition(ctx.getParameter("table"));

        updateTableDefinition(ctx, table);
        table.toJson(true).append(ctx.getReplyBuffer());
        ctx.setStatus(200);
    }

    public static long getPID() {
        String processName
                = java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
        return Long.parseLong(processName.split("@")[0]);
    }

    protected class Configuration implements SecurityConfiguration {
        Properties properties = new Properties();
        Environment props = new Environment(properties);
        Environment envs = new Environment();

        protected class Databases {

            public class Login {

                String name;
                String user;
                String password;

                private boolean equals(String a, String b) {
                    if (a == null && b == null) {
                        return true;
                    }
                    if (a == null || b == null) {
                        return false;
                    }

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
            protected Login security = new Login();
            protected Login reminder = new Login();

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

                if (name == null) {
                    name = config.getProperty("remdatabase");
                }
                if (user == null) {
                    user = config.getProperty("remuser");
                }
                if (password == null) {
                    password = config.getProperty("rempassword");
                }

                t.report('C', "Database " + name + " user " + user);
                reminder.load(name, user, password);
            }
        }
        protected Databases databases = new Databases();
        private String appName;
        private String dbServer;
        private String deadlockRetries;
        private String mysqlUseSSL;

        private String hashAlgorithm;
        private boolean logRequest;
        private boolean logReply;
        private boolean loginRequired;
        private double longStatementTime;
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

        public boolean getSSHRequired() {
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
        private Trace               trace;
        private boolean             resolveTimestamp = true;

        public void setTrace(Trace trace) {
            this.trace = trace;
        }

        public void printTrace(String message) {
            if (trace != null) {
                trace.report('C', message);
            }
        }

        public void addAnd(SQLBuilder sql, String field, String operator, String paramName) throws SQLException {
            String value = getParameter(paramName);

            if (value.trim().length() != 0) {
                sql.addAnd(field, operator, value);
            }
        }

        public String getTimestamp(Date date, String format) {
            return date == null ? null : (new SimpleDateFormat(format)).format(date);
        }

        public String getDbTimestamp(Date date) {
            return date == null ? null : DatabaseSession.getDateTimeString(date, appDb.getProtocol());
        }

        public String getDbDate(Date date) {
            return date == null ? null : DatabaseSession.getDateString(date, appDb.getProtocol());
        }

        public String getDbTime(Date date) {
            return date == null ? null : DatabaseSession.getTimeString(date);
        }

        public java.sql.Timestamp getSQLTimestamp(Date date) {
            return date == null ? null : new java.sql.Timestamp(date.getTime());
        }

        public java.sql.Date getSQLDate(Date date) {
            return date == null ? null : new java.sql.Date(date.getTime());
        }

        private DatabaseSession openDatabase(Configuration.Databases.Login login, boolean useMySql, boolean startTransaction) throws SQLException {
            Trace t = new Trace("openDatabase");
            DatabaseSession session = new DatabaseSession(useMySql ? "mysql" : "sqlserver", config.getDbServer(), login.name, startTransaction);

            if (login.name != null) {
                t.report('C', "Database " + login.name);

                session.setUser(login.user, login.password);

                if (useMySql && config.getMysqlUseSSL().length() != 0) {
                    session.addConnectionProperty("useSSL", config.getMysqlUseSSL());
                }

                session.connect();
                t.report('C', "Connection string " + session.getConnectionString());
            }
            session.SetLongStatementTime(config.getLongStatementTime());
            
            if (!useMySql) {
                session.close();
            }

            t.exit();

            return session;
        }

        private DatabaseSession openDatabase(Configuration.Databases.Login login, boolean useMySql) throws SQLException {
            return openDatabase(login, useMySql, false);
        }            

        public DatabaseSession getAppDb() {
            return appDb;
        }

        public DatabaseSession getSecDb() {
            return secDb == null ? appDb : secDb;
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

        public void outputReplyBuffer() throws IOException {
            printTrace("Starting response");
            handler.getResponse().getWriter().println(replyBuffer.toString());
            printTrace("Response added");
        }

        /*
         * This is the interface to handler.getParameter.
         *
         * It implements the resolveTimestamp feature. If this is enabled the parameter name Timestamp is
         * handled is follows.
         *
         * If the value return is null. The parameters Date and Time are retrieved and if they
         * are both not null, i.e. they exist as param, they are concatenated separatd by space and
         * returned as the value.
         *
         * All the following getParameter methods call this.
         */
        public String getParameter(String name) {
            String value = handler.getParameter(name);

            if (value.length() == 0 && resolveTimestamp && name.equals("Timestamp")) {
                value = handler.getParameter("Date", null);

                if (value != null && handler.getParameter("Time") != null) {
                    value += " " + handler.getParameter("Time");
                }
            }
            return value;
        }

        public boolean existsParameter(String name) {
            return handler.getParameter(name, null) != null;
        }

        public String getParameter(String name, String nullDefault) {
            String value = getParameter(name);

            return value == null ? nullDefault : value;
        }

        public String[] getParameters(String name) {
            return handler.getRequest().getParameterValues(name);
        }

        public int getInt(String name, int nullDefault) {
            String value = getParameter(name);

            if (value == null) {
                return nullDefault;
            }

            try {
                return Integer.parseInt(value);
            } catch (NumberFormatException e) {
                throw new ErrorExit("Parameter " + name + "-error converting '" + value + "' to integer");
            }
        }

        public double getDouble(String name, int nullDefault) {
            String value = getParameter(name);

            if (value.length() == 0) {
                return nullDefault;
            }

            try {
                return Double.parseDouble(value);
            } catch (NumberFormatException e) {
                throw new ErrorExit("Parameter " + name + "-error converting '" + value + "' to double");
            }
        }

        public Date getTimestamp(String date, String time) throws ParseException {
            String dt = getParameter(date).trim();
            String tm = getParameter(time).trim();

            return dt.length() == 0 && tm.length() == 0 ? null : DateFormatter.parseDate(dt + ' ' + tm);
        }

        public Date getTimestamp(String date) throws ParseException {
            String ts = getParameter(date);

            return ts == null || ts.trim().length() == 0 ? null : DateFormatter.parseDate(ts);
        }

        public java.sql.Timestamp getSQLTimestamp(String date) throws ParseException {
            Date ts = getTimestamp(date);

            return ts == null ? null : getSQLTimestamp(ts);
        }

        public Date getDate(String date) throws ParseException {
            return getTimestamp(date);
        }

        public void setStatus(int status, String location) {
            handler.getResponse().setStatus(status);

            int stat = handler.getResponse().getStatus();
            /*
             * This was introduced while investigating the setStatus issue described in the note at
             * the top of this package.
             */
            if (stat != status) {
                Report.error(location, (location == null ? "" : "From " + location + " ") + "setStatus ignored new status " + status + " still set to " + stat);
            }
        }

        public void setStatus(int status) {
            setStatus(status, null);
        }

        public void dumpRequest(String reason) throws ServletException, IOException {
            handler.dumpRequest(reason);
        }

        public void openDatabases(boolean useMySql, boolean startTransaction) throws SQLException {
            appDb = openDatabase(config.databases.application, useMySql, startTransaction);

            if (!config.databases.application.equals(config.databases.security)) {
                secDb = openDatabase(config.databases.security, useMySql);
            } else {
                secDb = null;
            }

            if (!config.databases.application.equals(config.databases.reminder)) {
                remDb = openDatabase(config.databases.reminder, useMySql);
            } else {
                remDb = appDb;
            }
        }
        
        public void openDatabases(boolean useMySql) throws SQLException {
            openDatabases(useMySql, false);
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

        private ResultSet rs = null;
        private boolean rowExists = false;

        public void close() throws SQLException {
            if (rs != null) {
                rs.close();
            }

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

            return rs.wasNull() ? -1 : val;
        }

        public int getInt(String colName) throws SQLException {
            int val = rs.getInt(colName);

            return rs.wasNull() ? -1 : val;
        }

        public Date getDate(String colName) throws SQLException {
            Date val = rs.getTimestamp(colName);

            return val;
        }
    }

    /*
     * For a table enables the records surrounding the key of a new record.
     */
    protected class EnclosingRecords {

        private final ArrayList<Field> fields = new ArrayList<>();
        private final Context ctx;

        private class Field {

            String name;
            boolean equals;
            SQLValue value;

            public Field(String name, SQLValue value, boolean equals) {
                this.name = name;
                this.equals = equals;
                this.value = value;
            }

            public Field(String name, Date value, boolean equals) {
                this(name, new SQLValue(value), equals);
            }

            public Field(String name, String value, boolean equals) {
                this(name, new SQLValue(value), equals);
            }

            public Field(String name, int value, boolean equals) {
                this(name, new SQLValue(value), equals);
            }
        }
        private final String table;
        private final SQLSelectBuilder sel;

        private ResultSet getBound(boolean before) throws SQLException {
            String operator;
            boolean desc;
            ResultSet rs;

            sel.clearWhere();
            sel.clearOrderBy();

            for (Field fld : fields) {
                if (fld.equals) {
                    operator = "=";
                    desc = false;
                } else if (before) {
                    operator = "<=";
                    desc = true;
                } else {
                    operator = ">";
                    desc = false;
                }
                sel.addAnd(fld.name, operator, fld.value);
                sel.addOrderByField(fld.name, desc);
            }
            sel.setMaxRows(1);

            rs = updateQuery(ctx, sel);

            return rs.next() ? rs : null;
        }

        /*
         * ctx   Application context.
         * table Database table to be searched.
         */
        public EnclosingRecords(Context ctx, String table) {
            this.ctx = ctx;
            this.table = table;
            this.sel = ctx.getSelectBuilder(this.table);
            this.sel.addField("*");
        }

        /*
         * name   Table column name.
         * value  Value of the field the new record will have for the column.
         * equals True if the field comparison is equal in the where clause,
         *        otherwise it is used to determine the new records position
         *        within the ordered records.
         *
         * Ideally all the key fields should be added with one of them having equals set to false.
         *
         * To explain the way it works. Assume a table has primary key Type, Start and the new record
         * will have Type = 'Gas' and Start = '01-Jan-2024'. The following addFields are made.
         *
         *   addField('Type',  'Gas',          true);
         *   addField('Start', '01-Jan-2024',  false);
         */
        public void addField(String name, String value, boolean equals) {
            fields.add(new Field(name, value, equals));
        }

        public void addField(String name, Date value, boolean equals) {
            fields.add(new Field(name, value, equals));
        }

        public void addField(String name, int value, boolean equals) {
            fields.add(new Field(name, value, equals));
        }

        /*
         * Returns the result set of the record the last record that is less than or equal the new record
         * where the column fields have equals false. Using the above example. The resulting query is
         *
         *   SELECT * FROM Table
         *   WHERE Type ='Gas' AND Start <= '2024-01-01'
         *   ORDER BY Type, Start DESC LIMIT 1
         */
        public ResultSet getBefore() throws SQLException {
            return getBound(true);
        }

        /*
         * Returns the result set of the record the first record that is greater than the new record
         * where the column fields have equals false. The resulting query is
         *
         *   SELECT * FROM Table
         *   WHERE Type ='Gas' AND Start > '2024-01-01'
         *   ORDER BY Type, Start LIMIT 1
         */
        public ResultSet getAfter() throws SQLException {
            return getBound(false);
        }
    }
    @Deprecated
    protected class TableUpdater {

        private final String name;
        private final ArrayList<DBField> fields = new ArrayList<>();
        private Context ctx;
        private ResultSet rs;
        private String keyString;

        private void appendKeyString(String field, String value) throws SQLException {
            if (value != null && !"".equals(value)) {
                if (!"".equals(keyString)) {
                    keyString += ", ";
                }

                keyString += field + " = " + value;
            } else {
                throw new SQLException("Table " + name + " key field " + field + " is null");
            }
        }

        private void addKey(SQLBuilder sql, Context ctx, String keySource) throws ParseException, SQLException {
            HashMap<String, String> overrides = new HashMap<>();

            for (String str : keySource.split(",")) {
                String flds[] = str.split("-");

                if (flds.length == 2) {
                    overrides.put(flds[0], flds[1]);
                }
            }
            keyString = "";

            for (DBField field : fields) {
                String value = "";

                if (field.key) {
                    String keyParam = overrides.containsKey(field.name) ? overrides.get(field.name) : field.parameter;

                    if (field.isDate) {
                        Date ts = ctx.getTimestamp(keyParam);
                        sql.addAnd(field.name, "=", ts);
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
            for (DBField field : fields) {
                if (field.isDate) {
                    rs.updateString(field.name, ctx.getDbTimestamp(ctx.getTimestamp(field.parameter)));
                } else {
                    String value = ctx.getParameter(field.parameter);

                    if (value.trim().equals("") && field.blankToNull) {
                        value = null;
                    }

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
                        break;
                    case "delete":
                        rs.moveToCurrentRow();
                        rs.deleteRow();
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
                        break;
                    case "update":
                    case "delete":
                        ctx.getReplyBuffer().append("No ").append(name).append(" row for ").append(keyString);
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
            for (DBField field : fields) {
                if (field.key) {
                    sql.addOrderByField(field.name, desc);
                }
            }
        }

        public void addFilter(SQLSelectBuilder sql) throws SQLException {
            if (ctx.existsParameter("filter")) {
                sql.addAnd(ctx.getParameter("filter"));
            }
        }
    }

    private class MeasureSql {

        Measurement m = null;

        public void start() {
            if (config.getMeasureSQL()) {
                m = new Measurement();
            } else {
                m = null;
            }
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
        String sqls = sql.build();

        measureSQL.start();
        rs = ctx.getAppDb().executeUpdateGetKey(sqls);
        measureSQL.end(sqls);

        return rs;
    }

    protected int executeUpdate(Context ctx, SQLBuilder sql) throws SQLException {
        return executeUpdate(ctx, sql.build());
    }

    protected boolean exists(Context ctx, String table, SQLNamedValues where) throws SQLException {
        ResultSet rs;
        SQLSelectBuilder sel = new SQLSelectBuilder(table, ctx.getAppDb().getProtocol());

        sel.addField("Count", "1");
        sel.addAnd(where);
        rs = ctx.getAppDb().executeQuery(sel.build());

        return rs.next();
    }

    private void rollback(Context ctx) {
        try {
            if (ctx.getAppDb() != null) {
                ctx.getAppDb().rollback();
            }
        } catch (SQLException rb) {
            Report.error(null, "Rollback", rb);
        }
    }

    private void rollback(Context ctx, int status) {
        rollback(ctx);
        ctx.setStatus(status, "rollback");
    }

    private void reply(Context ctx, Exception ex, int status) {
        Report.error("ErRep", ex);
        rollback(ctx, status);
        ctx.getReplyBuffer().append(ex.getMessage());
    }

    public abstract String getVersion();

    public abstract void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException;

    public abstract void processAction(Context ctx, String action) throws ServletException, IOException, SQLException, JSONException, ParseException;

    private void setKeyMessage(Context ctx, String prefix, String table, String key) {
        ctx.getReplyBuffer().append('!').append(prefix).append('!').append(table).append('!').append(key);
    }

    /*
     * Holds an unpcacked table update request from the HTML client. The request consists of the following parameters:
     *
     *   Name    Value
     *   Table   The table name to be updated.
     *   Action  The operation to be performed on the table and is one Read, Update, Create or Delete.
     *   Columns An array of values identifying the column column and consists of the following fields:
     *
     *              Name    Column
     *              Type    Data type of the value.
     *              IsPkey  True if the column is part of the primary key.
     *              Value   The value to be used in updating the table. It can contain commas.
     */
    protected class TableUpdateRequest {

        public class Column {

            private final String name;
            private final boolean isPkey;
            private final String type;
            private final String value;

            public Column(String column) {
                String fields[] = column.split(",", 4);
                name = fields[0];
                type = fields[1];
                isPkey = fields[2].equalsIgnoreCase("true");
                value = fields[3];
            }

            public String getName() {
                return name;
            }

            public boolean isPkey() {
                return isPkey;
            }

            public String getValue() {
                return value;
            }

            public String getType() {
                return type;
            }
        }
        private final String table;
        private final String action;
        private final ArrayList<Column> columns;

        public TableUpdateRequest(Context ctx) {
            this.columns = new ArrayList<>();

            String fields[] = ctx.getParameter("table").split(",");
            String reqcols[] = ctx.getParameters("column");

            table = fields[0];
            action = fields.length == 1 ? "Update" : fields[1];

            for (String col : reqcols) {
                columns.add(new Column(col));
            }
        }

        public String getTable() {
            return table;
        }

        public String getAction() {
            return action;
        }

        public ArrayList<Column> getColumns() {
            return columns;
        }
    }

    protected void updateTable(Context ctx) throws JSONException, ParseException, SQLException {
        String pKey = "";
        ResultSet rs;
        TableUpdateRequest request = new TableUpdateRequest(ctx);
        SQLBuilder sql = null;

        switch (request.getAction()) {
            case "Read":
                sql = new SQLSelectBuilder(request.getTable(), ctx.appDb.getProtocol());
                break;
            case "Create":
                sql = new SQLInsertBuilder(request.getTable(), ctx.appDb.getProtocol());
                break;
            case "Update":
                sql = new SQLUpdateBuilder(request.getTable(), ctx.appDb.getProtocol());
                break;
            case "Delete":
                sql = new SQLDeleteBuilder(request.getTable(), ctx.appDb.getProtocol());
                break;
        }
        for (TableUpdateRequest.Column col : request.getColumns()) {
            if (col.isPkey) {
                if (pKey.length() != 0) {
                    pKey += ", ";
                }

                pKey += col.getName() + "=" + col.getValue();
            }
            switch (request.getAction()) {
                case "Create":
                    sql.addField(col.getName(), col.getValue(), col.getType());
                    break;
                case "Update":
                    if (!col.isPkey()) {
                        sql.addField(col.getName(), col.getValue(), col.getType());
                    }
                    break;
                case "Read":
                    ((SQLSelectBuilder) sql).addField(col.getName());
                    break;
                case "Delete":
                // Only where clause required for delete.
            }
            if (!request.getAction().equals("Create") && col.isPkey()) {
                sql.addAnd(col.getName(), "=", col.getValue(), col.getType());
            }
        }
        switch (request.getAction()) {
            case "Read":
                JSONObject data = new JSONObject();

                rs = executeQuery(ctx, sql);
                data.add("TableRow", rs);

                if (data.get("Data").getArray().size() == 0) {
                    setKeyMessage(ctx, "Not found", request.getTable(), pKey);
                } else {
                    data.append(ctx.getReplyBuffer());
                }
                break;
            case "Update":
            case "Delete":
                int cnt = executeUpdate(ctx, sql);

                if (cnt == 0) {
                    setKeyMessage(ctx, "Not found", request.getTable(), pKey);
                }

                break;
            case "Create":
                try {
                executeUpdate(ctx, sql);
            } catch (SQLException ex) {
                if (ex.getMessage().startsWith("Duplicate")) {
                    setKeyMessage(ctx, "Already exists", request.getTable(), pKey);
                } else {
                    throw ex;
                }
            }
            break;
            default:
                Report.error("", "Action " + request.getAction() + " not valid");
        }
    }

    private void addRowColumn(JSONArray row, String colName) throws JSONException {
        JSONObject col = new JSONObject();

        col.add("Type", "varchar");
        col.add("Name", colName);
        row.add(col);
    }

    private void debugAction(Context ctx) throws JSONException {
        String request = ctx.getParameter("request");
        JSONObject data = new JSONObject();
        JSONArray row = new JSONArray();
        JSONArray rows;
        int max = -1;
        String value;

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

    private boolean remindersDue(Context ctx, boolean ignoreDelay) throws SQLException, ParseException {
        Reminder.State state = reminder.alert(ignoreDelay);

        if (state.alerts()) {
            ctx.getReplyBuffer().append(state.getImmediate() != 0 ? "!ReminderImmediate" : "!ReminderAlert");
            ctx.getReplyBuffer().append(',');
            ctx.getReplyBuffer().append(state.getAlertFrequency());
            ctx.getReplyBuffer().append(',');
            ctx.getReplyBuffer().append(ctx.getTimestamp(state.getEarliest(), "yyyy-MM-dd HH:mm"));
            ctx.getReplyBuffer().append(';');
            Report.comment(null, "Reminder alerts due");
            return true;
        }
        return false;
    }

    /*
     * The specific application code can override this if it wants to perform additional procesing for the
     * the actions handled by the application code,
     *
     * Implementations should ignore actions that are not relevant to them, i.e. it should not generate
     * an error for them.
     */
    protected void completeAction(Context ctx, boolean start) throws SQLException, ErrorExit, ParseException {

    }

    private void processAction(Context ctx, Security security) throws ServletException, IOException, SQLException, NoSuchAlgorithmException, ParseException, JSONException {
        Trace t = new Trace("ASProcessAction");
        String action = ctx.getParameter("action");
        boolean complete = true;

        t.report('C', action);
        /*
         * Start with the actions that don't require the user to be logged in.
         */
        if (action.equals("login")) {
            security.login();

            if (security.isLoggedIn()) {
                reminder.setNoAlerts(false);
            }

            ctx.getReplyBuffer().append(security.getReply());
        } else if (action.equals("logoff")) {
            security.logOff();
        } else if (action.equals("enablemysql")) {
            ctx.getReplyBuffer().append(config.isSqlServerAvailable() ? "yes" : "no");
        } else if (security.isSecurityFailure()) {
            /*
             * Return if the user has incurred a security failure, most likely being not logged in. 
             */
            ctx.getReplyBuffer().append(security.getReply());
        } else {
            /*
             * All the actions from here on require the user to be logged in.
             */
            complete = true;
            completeAction(ctx, true);

            switch (action) {
                case "getList":
                    getList(ctx);
                    break;
                case "createTableRow":
                case "updateTableRow":
                case "deleteTableRow":
                    changeTableRow(ctx);
                    break;
                case "loggedin":
                    ctx.getReplyBuffer().append(security.isLoggedIn() ? "true" : "false");
                    break;
                case "updatetable":
                    updateTable(ctx);
                    break;
                case "debug":
                    debugAction(ctx);
                    break;
                case "getTableDefinition":
                    getTableDefinition(ctx);
                    break;
                case "checkRemindersDue":
                    reminder.setNoAlerts(true);
                    remindersDue(ctx, true);
                    break;
                case "":
                    /*
                     * Setting the null parameter to response causes a problem. Writing to the response seems to
                     * cause subsequent setStatus calls to be ignored.
                     */
                    ctx.getHandler().dumpRequest(null, "No action parameter");
                    invalidAction();
                    break;
                default:
                    if (!config.getAppName().equals("Reminder") && !reminder.getNoAlerts()) {
                        /*
                        * If reminders are due, places the reminder details at the start of the reply
                         */
                        remindersDue(ctx, false);
                    }
                    complete = false;
                    processAction(ctx, action);
                    break;
            }
            if (complete) {
                completeAction(ctx, false);
            }
        }
    }

    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);
        String arRoot = System.getenv("AR_ROOT");
        String arFile = System.getenv("AR_FILE");
        Process.setReportingRoot(arRoot);

        if (arFile != null) {
            Process.setConfigFile(arFile);
        }

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
                "Version " + getVersion()
                + " Home Dir " + System.getProperty("user.home")
                + " Current Dir " + System.getProperty("user.dir")
                + " Report Config " + Process.getConfigFile().getAbsoluteFile());
        t.report('C', "Servlet name " + config.getServletName() + " started");
        t.exit();
    }

    /*
     * Currently the mysql flag is passed in the action parameters. It makes more sense to pass it in the
     * session data, and set it in the session data at log on.
     * 
     * This method looks in both places and uses the parameters by preference. Eventually will be changed
     * to use the session data by preference once the client side has been changed to use session data only.
     */
    protected boolean getMySQL(Context ctx) {
        Cookie cookie = ctx.getHandler().getCookie("mysql");
        String mysqlp = ctx.getParameter("mysql");
        String mysqlc = cookie == null ? "" : cookie.getValue();

        if (mysqlp.length() != 0) {
            if (mysqlc.length() != 0 && !mysqlp.equals(mysqlc)) {
                Report.error(null, "Session mysql " + mysqlc + " does equal parameter mysql " + mysqlp);
            }
        } else {
            mysqlp = mysqlc;
        }

        return mysqlp.equalsIgnoreCase("true");
    }

    protected void processRequest(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        Thread.attach(config.getAppName());
        Measurement m = new Measurement();
        Trace t = new Trace("processRequest");
        Context ctx = new Context();
        response.setContentType("text/html;charset=UTF-8");

        ctx.handler = new HTTPRequestHandler(request, response);
        ctx.replyBuffer = new StringBuilder();

        String action = ctx.getParameter("action");
        boolean useMySql = getMySQL(ctx);
        int maxRepeats = 5;
        int repeat = 0;

        ctx.setTrace(t);
        try {
            Report.comment(null, "processRequest called with action " + action + " sessionId " + ctx.getHandler().getCookie("sessionid") + " mysql " + useMySql + " default " + System.getProperty("user.dir"));

            if (!config.isSqlServerAvailable()) {
                useMySql = true;
            }

            t.report('C', "action " + action + " server " + config.getDbServer() + " database " + config.databases.application.name + " user " + config.databases.application.user);

            ctx.openDatabases(useMySql || !config.isSqlServerAvailable(), true);

            Security security = new Security(ctx.getSecDb(), ctx.handler, config);

            if (reminder == null) {
                reminder = new Reminder(ctx.getRemDb());
                reminder.setAlertOptions(
                        this.config.getIntProperty("reminderalertrepeat", 0),
                        this.config.getIntProperty("reminderalertimmediate", 1));
            } else {
                reminder.changeDatabase(ctx.getRemDb());
            }

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
            reply(ctx, ex, 410);
        } catch (ErrorExit ex) {
            if (ex.getMessage().equals("ActionError")) {
                ex.setMessage(action.length() == 0 ? "No action parameter" : "Action " + action + " is invalid");
            }

            reply(ctx, ex, ex.getStatus());
        } catch (IOException | ServletException | ParseException | NoSuchAlgorithmException | JSONException ex) {
            reply(ctx, ex, 400);
        } finally {
            try {
                ctx.getAppDb().commit();
            } catch (SQLException ex) {
                Logger.getLogger(ApplicationServer.class.getName()).log(Level.SEVERE, null, ex);
            }
            
        }
        if (repeat != 0) {
            t.report('C', "Deadlock count " + repeat);
        }

        ctx.outputReplyBuffer();

        if (response.getStatus() != 200) {
            t.report('C', ctx.getReplyBuffer().toString());
        }

        if (config.getLogReply()) {
            Report.comment(null, ctx.getReplyBuffer().toString());
        }

        t.exit();
        m.report(true, "Action " + action);
        Thread.detach();
    }

    @Override
    public void destroy() {
        Thread.attach(config.getAppName());
        Report.comment(null, "Servlet stopped");
    }

    // <editor-fold defaultstate="collapsed" desc="HttpServlet methods. Click on the + sign on the left to edit the code.">
    /**
     * Handles the HTTP <code>GET</code> method.
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
     * Handles the HTTP <code>POST</code> method.
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
