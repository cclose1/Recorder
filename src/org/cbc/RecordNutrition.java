/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.Date;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLDeleteBuilder;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;

/**
 *
 * @author Chris
 */
public class RecordNutrition extends ApplicationServer {

    private boolean eventFor(Context ctx, Date timestamp) throws SQLException {
        ResultSet rs = executeQuery(ctx, "SELECT Timestamp FROM NutritionEvent WHERE Timestamp = '" + ctx.getDbTimestamp(timestamp) + "'");

        return rs.next();
    }

    private String getWeight(Context ctx, Date date) throws SQLException {
        SQLSelectBuilder sql = ctx.getSelectBuilder("Weight");

        sql.addField("Kilos");
        sql.addAnd("Date", "=", date);

        ResultSet rs = updateQuery(ctx, sql.build());

        if (rs.next()) {
            return rs.getString("Kilos");
        }

        return "";
    }

    private void updateWeight(Context ctx, Date timestamp, String weight) throws SQLException {
        SQLSelectBuilder sql = ctx.getSelectBuilder("Weight");

        if (weight == null || weight.length() == 0) {
            return;
        }

        sql.addField("Date");
        sql.addField("Time");
        sql.addField("Kilos");

        sql.setWhere("Date = '" + ctx.getDbDate(timestamp) + "'");

        ResultSet rs = updateQuery(ctx, sql.build());

        if (rs.next()) {
            /*
             * The database date time starts at 00:00:00. Calculate the number of seconds between the database time
             * and now. If this is less than a day the current update is for the current date and in this event we apply
             * the weight update. Changes to existing weight table entried for previous days are ignored.
             */
            double seconds = (System.currentTimeMillis() - rs.getDate("Date").getTime()) / 1000.0;

            if (seconds < 24 * 60 * 60) {
                rs.moveToCurrentRow();
                rs.updateString("Kilos", weight);
                rs.updateRow();
            }
        } else {
            rs.moveToInsertRow();
            rs.updateString("Date", ctx.getDbDate(timestamp));
            rs.updateString("Time", ctx.getDbTime(timestamp));
            rs.updateString("Kilos", weight);
            rs.insertRow();
        }
    }

    protected void setNumericItemField(ResultSet rs, String name, String value, double scale) throws SQLException {

        if (value.length() == 0) {
            rs.updateNull(name);
        } else {
            rs.updateDouble(name, Double.parseDouble(value) / scale);
        }
    }

    private void setItemFields(Context ctx, ResultSet rs) throws SQLException {
        String  fld    = ctx.getParameter("size");
        boolean simple = ctx.getParameter("simple").equalsIgnoreCase("true");
        boolean volume = ctx.getParameter("volume").equalsIgnoreCase("true");

        double scale = 1;

        if (fld.length() != 0) scale = Double.parseDouble(fld);

        rs.updateString("Item",     ctx.getParameter("item"));
        rs.updateString("Source",   ctx.getParameter("source"));
        rs.updateString("Type",     ctx.getParameter("type"));
        rs.updateString("Comment",  ctx.getParameter("comment"));
        rs.updateString("Simple",   simple ? "Y" : "N");
        rs.updateString("IsVolume", simple && volume ? "Y" : "N");

        setNumericItemField(rs, "Calories",     ctx.getParameter("calories"),     scale);
        setNumericItemField(rs, "Protein",      ctx.getParameter("protein"),      scale);
        setNumericItemField(rs, "Cholesterol",  ctx.getParameter("cholesterol"),  scale);
        setNumericItemField(rs, "Fat",          ctx.getParameter("fat"),          scale);
        setNumericItemField(rs, "Saturated",    ctx.getParameter("saturated"),    scale);
        setNumericItemField(rs, "Carbohydrate", ctx.getParameter("carbohydrate"), scale);
        setNumericItemField(rs, "Sugar",        ctx.getParameter("sugar"),        scale);
        setNumericItemField(rs, "Fibre",        ctx.getParameter("fibre"),        scale);
        setNumericItemField(rs, "Salt",         ctx.getParameter("salt"),         scale);
        setNumericItemField(rs, "ABV",          ctx.getParameter("abv"),          1);
        setNumericItemField(rs, "DefaultSize",  ctx.getParameter("default"),      1);
        setNumericItemField(rs, "PackSize",     ctx.getParameter("packsize"),     1);
    }

    public String getVersion() {
        return "V5.0 Released 28-Jul-2022";
    }

    public void initApplication(ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {
        databases.setApplication(
                super.config.getProperty("ntdatabase"),
                super.config.getProperty("ntuser"),
                super.config.getProperty("ntpassword"));
    }

    private void addItemStartTime(Context ctx, SQLSelectBuilder sql) throws ParseException, SQLException {
        Date startTime = ctx.getTimestamp("starttime");

        sql.addAndStart(startTime == null ? new Date() : startTime);
    }
    /*
     * In some cases updating a value via the record set fails for MySQL. The following error message
     *  
     *  Cannot convert class java.time.LocalDateTime to SQL type requested due to java.lang.ArrayIndexOutOfBoundsException - 2  
     *
     * On attempting to update any field in the record set, irrespective of the field type.
     *
     * Updating NutritionEvent table is such a case. However, updating NutritionDetail table works using a MySQL record set works.
     * There seems to be no essential difference between between the code that works and that which doesn't.
     *
     * The following is a work around that uses an update sql statement instead of the record set update.
     *
     * Would like to investigate further to understand why this happens. This is not a satifactory solution.
     */
    private void updateNutritionEvent(Context ctx, ResultSet rs) throws SQLException, ParseException {
        Date   timestamp   = ctx.getTimestamp("date", "time");
        String description = ctx.getParameter("description");

        if (rs.next()) {
            if (ctx.getAppDb().getProtocol().equalsIgnoreCase("sqlserver")) {
                rs.moveToCurrentRow();
                rs.updateString("Description", description);
                rs.updateRow();
            } else {
                /*
                 * For MySQL replace above with an update query.
                 */
                SQLUpdateBuilder sql = ctx.getUpdateBuilder("NutritionEvent");

                sql.addField("Description", description);
                sql.addAnd("Timestamp", "=", timestamp);
                executeUpdate(ctx, sql);
            }
        } else {
            rs.moveToInsertRow();
            rs.updateString("Timestamp",   ctx.getDbTimestamp(timestamp));
            rs.updateString("Description", description);
            rs.insertRow();
        }
    }
    /*
     * NutritionRecord is another table that fails. See comment for updateNutritionEvent.
    */
    private void updateNutritionRecord(Context ctx, ResultSet rs) throws SQLException, ParseException {
        Date   timestamp = ctx.getTimestamp("date", "time");
        String item      = ctx.getParameter("item");
        String source    = ctx.getParameter("source");
        String quantity  = ctx.getParameter("quantity");
        String abv       = ctx.getParameter("abv");

        if (rs.next()) {
            if (ctx.getAppDb().getProtocol().equalsIgnoreCase("sqlserver")) {
                rs.moveToCurrentRow();
                rs.updateString("Quantity", quantity);

                if (abv.length() != 0) rs.updateString("ABV", abv);
                
                rs.updateRow();            
            } else {
                SQLUpdateBuilder sql = ctx.getUpdateBuilder("NutritionRecord");
                
                sql.addField("Quantity", quantity);
                
                if (abv.length() != 0) sql.addField("ABV", abv);
                
                sql.addAnd("Timestamp", "=", timestamp);
                sql.addAnd("Item",      "=", item);
                sql.addAnd("Source",    "=", source);
                executeUpdate(ctx, sql);
            }
        } else {
            rs.moveToInsertRow();
            rs.updateString("Timestamp",   ctx.getDbTimestamp(timestamp));
            rs.updateString("Item",        ctx.getParameter("item"));
            rs.updateString("Source",      ctx.getParameter("source"));
            rs.updateString("Quantity",    quantity);
            rs.updateString("IsComposite", ctx.getParameter("simple").equalsIgnoreCase("c") ? "Y" : "N");

            if (abv.length() != 0) rs.updateString("ABV", abv);
            
            rs.insertRow();
        }
    }
    public void processAction(
            Context ctx,
            String action) throws ServletException, IOException, SQLException, JSONException, ParseException {

        switch (action) {
            case "getweight":
                Date date = ctx.getDate("date");
                ctx.getReplyBuffer().append(getWeight(ctx, date));
                ctx.setStatus(200);
                break;
            case "getitem":
                {
                    SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionDetail");
                    sql.addField("iitem",         "Item");
                    sql.addField("isource",       "Source");
                    sql.addField("itype",         "Type");
                    sql.addField("istart",        "Start");
                    sql.addField("iend",          "End");
                    sql.addField("icomment",      "Comment");
                    sql.addField("ivolume",       "IsVolume");
                    sql.addField("icalories",     "Calories");
                    sql.addField("iprotein",      "Protein");
                    sql.addField("icholesterol",  "Cholesterol");
                    sql.addField("ifat",          "Fat");
                    sql.addField("isaturated",    "Saturated");
                    sql.addField("icarbohydrate", "Carbohydrate");
                    sql.addField("isugar",        "Sugar");
                    sql.addField("ifibre",        "Fibre");
                    sql.addField("isalt",         "Salt");
                    sql.addField("isimple",       "Simple");
                    sql.addField("iabv",          "ABV");
                    sql.addField("idefault",      "DefaultSize");
                    sql.addField("ipacksize",     "PackSize");
                    sql.addAnd("Item",   "=", ctx.getParameter("iitem"));
                    sql.addAnd("Source", "=", ctx.getParameter("isource"));
                    addItemStartTime(ctx, sql);
                    JSONArray fields = new JSONArray();
                    ResultSet rs     = executeQuery(ctx, sql);
                    fields.addFields(rs);
                    fields.append(ctx.getReplyBuffer());
                    ctx.setStatus(200);
                    break;
                }
            case "getitemcount":
                {
                    SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionDetail");
                    sql.addField("Count",  sql.setFieldSource("Count(*)"));
                    sql.addAnd("Item",   "=", ctx.getParameter("iitem"));
                    sql.addAnd("Source", "=", ctx.getParameter("isource"));
                    ResultSet rs = executeQuery(ctx, sql);
                    ctx.getReplyBuffer().append(rs.next()? rs.getInt("Count") : 0);
                    ctx.setStatus(200);
                    break;
                }
            case "applyitemupdate":
                {
                    Date   start    = ctx.getTimestamp("start");
                    Date   end      = ctx.getTimestamp("end");
                    Date   previous = ctx.getTimestamp("previousStart");
                    String command  = ctx.getParameter("command");
                    String item     = ctx.getParameter("item");
                    String source   = ctx.getParameter("source");
                    ResultSet rs;
                    ctx.getAppDb().startTransaction();
                    if (previous != null) {
                        SQLUpdateBuilder sql = ctx.getUpdateBuilder("NutritionDetail");
                        
                        sql.addField("End", start);
                        sql.addAnd("Start",  "=", previous);
                        sql.addAnd("Item",   "=", item);
                        sql.addAnd("Source", "=", source);
                        executeUpdate(ctx, sql);
                        command = "create";
                    }       if (command.equalsIgnoreCase("create")) {
                        rs = ctx.getAppDb().insertTable("NutritionDetail");
                        rs.moveToInsertRow();
                        setItemFields(ctx, rs);
                        rs.updateString("Start", ctx.getDbTimestamp(start));
                        rs.updateString("End",   ctx.getDbTimestamp(end));
                        rs.insertRow();
                        ctx.setStatus(200);
                    } else {
                        SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionDetail");
                        sql.addAnd("Item",   "=", item);
                        sql.addAnd("Source", "=", source);
                        sql.addAnd("Start",  "=", start);
                        rs = updateQuery(ctx, sql.build());
                        
                        if (!rs.next()) {
                            ctx.getReplyBuffer().append("No record for Item '").append(item).append(", Source '").append(source).append("'");
                        } else {
                            rs.moveToCurrentRow();
                            setItemFields(ctx, rs);
                            rs.updateRow();
                            ctx.setStatus(200);
                        }
                    }       rs.close();
                    ctx.getAppDb().commit();
                    break;
                }
            case "eventhistory":
                {
                    JSONObject data = new JSONObject();
                    SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionEventSummary");
                    sql.setProtocol(ctx.getAppDb().getProtocol());
                    sql.setMaxRows(config.getIntProperty("nutritionhistoryrows", 100));
                    sql.addField("Timestamp");
                    sql.addField("Weekday");
                    sql.addField("Description", sql.setValue(""));
                    sql.addField("Comment",     sql.setValue(""));
                    sql.addField("Calories");
                    sql.addField("Protein");
                    sql.addField("Fat");
                    sql.addField("Saturated");
                    sql.addField("Carb",        "Carbohydrate");
                    sql.addField("Sugar");
                    sql.addField("Fibre");
                    sql.addField("Salt");
                    sql.addField("Units");
                    sql.setOrderBy("Timestamp DESC");
                    if (ctx.existsParameter("filter")) {
                        sql.addAnd(ctx.getParameter("filter"));
                    } else {
                        ctx.addAnd(sql, "Weekday",     "=",    "day");
                        ctx.addAnd(sql, "Description", "LIKE", "description");
                    }       ResultSet rs = executeQuery(ctx, sql);
                    data.add("EventHistory", rs);
                    data.append(ctx.getReplyBuffer());
                    ctx.setStatus(200);
                    break;
                }
            case "requestitemlist":
                {
                    JSONObject       data   = new JSONObject();
                    SQLSelectBuilder sql    = ctx.getSelectBuilder("NutritionItem");
                    sql.addField("Item");
                    sql.addField("ABV",         sql.setValue(0));
                    sql.addField("Source",      sql.setValue(""));
                    sql.addField("Type",        sql.setValue(""));
                    sql.addField("Simple",      sql.setValue(""));
                    sql.addField("IsVolume",    sql.setValue(""));
                    sql.addField("DefaultSize", sql.setValue(0));
                    sql.addField("Salt");
                    sql.addField("Calories");
                    sql.addField("Protein");
                    sql.addField("Fat");
                    sql.addField("Carbohydrate");
                    sql.setOrderBy("Item");
                    ctx.addAnd(sql, "Source", "=",    "source");
                    ctx.addAnd(sql, "Type",   "=",    "type");
                    ctx.addAnd(sql, "Item",   "LIKE", "item");
                    addItemStartTime(ctx, sql);
                    ResultSet rs = executeQuery(ctx, sql.build());
                    data.add("ItemDetails", rs);
                    data.append(ctx.getReplyBuffer());
                    ctx.setStatus(200);
                    break;
                }
            case "getList":
                getList(ctx);
                /*
                String field = ctx.getParameter("field");
                
                if (field.equalsIgnoreCase("source")) {
                getList(ctx, "NutritionSources", "Name");
                } else {
                getList(ctx, "NutritionTypes", "Name");
                }
                */              break;
            case "addListItem":
                {
                    String           field = ctx.getParameter("field");
                    String           table = field.equalsIgnoreCase("source") ? "NutritionSources" : "NutritionTypes";
                    SQLInsertBuilder sql   = ctx.getInsertBuilder(table);
                    sql.addField("Name", ctx.getParameter("item"));
                    executeUpdate(ctx, sql);
                    ctx.setStatus(200);
                    break;
                }
            case "createevent":
                {
                    Date timestamp     = ctx.getTimestamp("crdate", "crtime");
                    String description = ctx.getParameter("crdescription");
                    String comment     = ctx.getParameter("crcomment");
                    String weight      = ctx.getParameter("crweight");
                    if (eventFor(ctx, timestamp)) {
                        ctx.getReplyBuffer().append("Change time as event already recorded for ").append(timestamp);
                    } else {
                        SQLInsertBuilder sql = ctx.getInsertBuilder("NutritionEvent");
                        
                        sql.addField("Timestamp",   ctx.getDbTimestamp(timestamp));
                        sql.addField("Description", description);
                        sql.addField("Comment",     comment);
                        executeUpdate(ctx, sql);
                    }       updateWeight(ctx, timestamp, weight);
                    ctx.setStatus(200);
                    break;
                }
            case "updateevent":
                {
                    Date timestamp     = ctx.getTimestamp("date", "time");
                    String description = ctx.getParameter("description");
                    String comment     = ctx.getParameter("comment");
                    SQLUpdateBuilder sql = ctx.getUpdateBuilder("NutritionEvent");
                    sql.addField("Description", description);
                    sql.addField("Comment",     comment);
                    sql.addAnd("Timestamp", "=", timestamp);
                    executeUpdate(ctx, sql);
                    ctx.setStatus(200);
                    break;
                }
            case "copyevent":
                Date   sTimestamp   = ctx.getTimestamp("sdate", "stime");
                Date   cTimestamp   = ctx.getTimestamp("cdate", "ctime");
                String cDescription = ctx.getParameter("cdescription");
                String cComment     = ctx.getParameter("ccomment");
                if (eventFor(ctx, cTimestamp)) {
                    ctx.getReplyBuffer().append("Change time as event already recorded for ").append(cTimestamp);
                } else {
                    SQLInsertBuilder sql = ctx.getInsertBuilder("NutritionEvent");
                    
                    sql.addField("Timestamp",   cTimestamp);
                    sql.addField("Description", cDescription);
                    sql.addField("Comment",     cComment);
                    executeUpdate(ctx, sql);
                    executeUpdate(ctx,
                            "INSERT NutritionRecord(Timestamp, Item, Source, Quantity, ABV, IsComposite) "
                                    + "SELECT '" + ctx.getDbTimestamp(cTimestamp) + "', Item, Source, Quantity, ABV, IsComposite "
                                            + "FROM   NutritionRecord "
                                            + "WHERE Timestamp = ' " + ctx.getDbTimestamp(sTimestamp) + "'");
                }   updateWeight(ctx, cTimestamp, ctx.getParameter("cweight"));
                ctx.setStatus(200);
                break;
            case "deleteevent":
                {
                    Date timestamp = ctx.getTimestamp("date", "time");
                    SQLDeleteBuilder sql = ctx.getDeleteBuilder("NutritionRecord");
                    sql.addAnd("Timestamp", "=", timestamp);
                    executeUpdate(ctx, sql.build());
                    sql.setTable("NutritionEvent");
                    executeUpdate(ctx, sql.build());
                    ctx.setStatus(200);
                    break;
                }
            case "removeitem":
                {
                    Date             timestamp   = ctx.getTimestamp("date", "time");
                    String           item        = ctx.getParameter("item");
                    String           source      = ctx.getParameter("source");
                    String           description = ctx.getParameter("description");
                    SQLDeleteBuilder sqld        = ctx.getDeleteBuilder("NutritionRecord");
                    SQLUpdateBuilder sqlu        = ctx.getUpdateBuilder("NutritionEvent");
                    sqld.addAnd("Timestamp", "=", timestamp);
                    sqld.addAnd("Item",      "=", item);
                    sqld.addAnd("Source",    "=", source);
                    executeUpdate(ctx, sqld.build());
                    sqlu.addField("Description", description);
                    sqlu.addAnd("Timestamp", "=", timestamp);
                    executeUpdate(ctx, sqlu.build());
                    ctx.setStatus(200);
                    break;
                }
            case "modifyitem":
                {
                    Date   timestamp = ctx.getTimestamp("date", "time");
                    String item      = ctx.getParameter("item");
                    String source    = ctx.getParameter("source");
                    SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionEvent");
                    sql.addField("Timestamp");
                    sql.addField("Description");
                    sql.addAnd("Timestamp", "=", timestamp);
                    ResultSet rs = updateQuery(ctx, sql.build());
                    updateNutritionEvent(ctx, rs);
                    sql.clear();
                    sql.setFrom("NutritionRecord");
                    sql.addField("Timestamp");
                    sql.addField("Item");
                    sql.addField("Source");
                    sql.addField("Quantity");
                    sql.addField("ABV");
                    sql.addField("IsComposite");
                    sql.addAnd("Timestamp", "=", timestamp);
                    sql.addAnd("Item",      "=", item);
                    sql.addAnd("Source",    "=", source);
                    rs = updateQuery(ctx, sql.build());
                    updateNutritionRecord(ctx, rs);
                    ctx.setStatus(200);
                    break;
                }
            case "getactiveevent":
                {
                    JSONObject       data      = new JSONObject();
                    Date             timestamp = ctx.getTimestamp("date", "time");
                    SQLSelectBuilder sql       = ctx.getSelectBuilder(null);
                    sql.addField("Item");
                    sql.addField("Simple",       sql.setValue(""));
                    sql.addField("IsVolume",     sql.setValue(""));
                    sql.addField("ABV",          sql.setValue(0));
                    sql.addField("Quantity",     sql.setValue(0));
                    sql.addField("Source",       sql.setValue(""));
                    sql.addField("Type",         sql.setValue(""));
                    sql.addField("Calories",     sql.setValue(0));
                    sql.addField("Protein",      sql.setValue(0));
                    sql.addField("Fat",          sql.setValue(0));
                    sql.addField("Saturated",    sql.setValue(0));
                    sql.addField("Carbohydrate", sql.setValue(0));
                    sql.addField("Sugar",        sql.setValue(0));
                    sql.addField("Salt",         sql.setValue(0));
                    sql.setOrderBy("Item");
                    sql.setFrom("NutritionRecordFull");
                    sql.addAnd("Timestamp", "=", timestamp);
                    ResultSet rs = executeQuery(ctx, sql);
                    data.add("ItemDetails", rs);
                    data.append(ctx.getReplyBuffer());
                    ctx.setStatus(200);
                    break;
                }
            case "checktimestamp":
                {
                    Date timestamp = ctx.getTimestamp("date", "time");
                    if (eventFor(ctx, timestamp)) {
                        ctx.getReplyBuffer().append("Change time as event already recorded for ").append(ctx.getDbTimestamp(timestamp));
                    }       ctx.setStatus(200);
                    break;
                }
            default:
                ctx.dumpRequest("Action " + action + " is invalid");
                ctx.getReplyBuffer().append("Action ").append(action).append(" is invalid");
                break;
        }
    }
}
