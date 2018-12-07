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
                
        if (rs.next()) return rs.getString("Kilos");
        
        return "";
    }
    private void updateWeight(Context ctx, Date timestamp, String weight) throws SQLException {
        SQLSelectBuilder sql  = ctx.getSelectBuilder("Weight");
        
        if (weight == null || weight.length()== 0) return;
        
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
            
            if (seconds < 24*60*60) {
                rs.moveToCurrentRow();
                rs.updateString("Kilos", weight);
                rs.updateRow();
            }
        } else {
            rs.moveToInsertRow();
            rs.updateString("Date",  ctx.getDbDate(timestamp));
            rs.updateString("Time",  ctx.getDbTime(timestamp));
            rs.updateString("Kilos", weight);
            rs.insertRow();
        } 
    }
    private void setItemFields(Context ctx, ResultSet rs) throws SQLException {
        String  fld    = ctx.getParameter("size");
        boolean simple = ctx.getParameter("simple").equalsIgnoreCase("true");
        double  scale  = 1;
        
        if (fld.length() != 0) scale = Double.parseDouble(fld);
        
        rs.updateString("Item",   ctx.getParameter("item"));
        rs.updateString("Source", ctx.getParameter("source"));
        rs.updateString("Type",   ctx.getParameter("type"));
        rs.updateString("Simple", simple? "Y" : "N");
        
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
        return "V4.2 Released 05-Dec-2018   ";  
    }
    public void initApplication (ServletConfig config, Configuration.Databases databases) throws ServletException, IOException {
        databases.setApplication(
                super.config.getProperty("ntdatabase"),
                super.config.getProperty("ntuser"),
                super.config.getProperty("ntpassword"));
    }
    public void processAction(
            Context ctx,
            String  action) throws ServletException, IOException, SQLException, JSONException, ParseException {

        if (action.equals("getweight")) {
            Date date = ctx.getDate("date");

            ctx.getReplyBuffer().append(getWeight(ctx, date));
            ctx.setStatus(200);
        } else if (action.equals("getitem")) {
            SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionDetail");

            sql.addField("Item",         "iitem");
            sql.addField("Calories",     "icalories");
            sql.addField("Source",       "isource");
            sql.addField("Type",         "itype");
            sql.addField("Start",        "istart");
            sql.addField("End",          "iend");
            sql.addField("Protein",      "iprotein");
            sql.addField("Cholesterol",  "icholesterol");
            sql.addField("Fat",          "ifat");
            sql.addField("Saturated",    "isaturated");
            sql.addField("Carbohydrate", "icarbohydrate");
            sql.addField("Sugar",        "isugar");
            sql.addField("Fibre",        "ifibre");
            sql.addField("Salt",         "isalt");
            sql.addField("Simple",       "isimple");
            sql.addField("ABV",          "iabv");
            sql.addField("DefaultSize",  "idefault");
            sql.addField("PackSize",     "ipacksize");

            sql.addAnd("Item",   "=", ctx.getParameter("iitem"));
            sql.addAnd("Source", "=", ctx.getParameter("isource"));
            sql.addAndStart(new Date());
            JSONArray fields = new JSONArray();
            ResultSet rs     = executeQuery(ctx, sql);

            fields.addFields(rs);
            fields.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("applyitemupdate")) {
            String    command = ctx.getParameter("command");
            String    item    = ctx.getParameter("item");
            String    source  = ctx.getParameter("source");
            ResultSet rs;

            ctx.getAppDb().startTransaction();

            if (command.equalsIgnoreCase("create")) {
                rs = ctx.getAppDb().insertTable("NutritionDetail");
                rs.moveToInsertRow();
                setItemFields(ctx, rs);
                rs.updateString("Start", ctx.getParameter("start"));
                rs.updateString("End",   ctx.getParameter("end"));
                rs.insertRow();
                ctx.setStatus(200);
            } else {
                SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionDetail");
                sql.addAnd("Item",   "=", item);
                sql.addAnd("Source", "=", source);
                rs = updateQuery(ctx, sql.build());

                if (!rs.next()) {
                    ctx.getReplyBuffer().append("No record for Item '" + item + ", Source '" + source + "'");
                } else {
                    rs.moveToCurrentRow();
                    setItemFields(ctx, rs);
                    rs.updateRow();
                    ctx.setStatus(200);
                }
            }
            rs.close();
            ctx.getAppDb().commit();
        } else if (action.equals("eventhistory")) {
            JSONObject       data = new JSONObject();
            SQLSelectBuilder sql  = ctx.getSelectBuilder("NutritionEventSummary");

            sql.setProtocol(ctx.getAppDb().getProtocol());
            sql.setMaxRows(config.getIntProperty("nutritionhistoryrows", 100));

            sql.addField("Timestamp");
            sql.addField("Weekday");
            sql.addDefaultedField("Description", "");
            sql.addDefaultedField("Comment", "");
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

            sql.addAnd("WeekDay",     "=",    ctx.getParameter("day"));
            sql.addAnd("Description", "LIKE", ctx.getParameter("description"));

            ResultSet rs = executeQuery(ctx, sql);
            
            data.add("EventHistory", rs);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("requestdetails")) {
            JSONObject       data   = new JSONObject();
            String           source = ctx.getParameter("source");
            String           type   = ctx.getParameter("type");
            String           item   = ctx.getParameter("item");
            SQLSelectBuilder sql    = ctx.getSelectBuilder("NutritionItem");

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
            sql.addAndStart(new Date());

            ResultSet rs = executeQuery(ctx, sql.build());
            data.add("ItemDetails", rs);
            data.append(ctx.getReplyBuffer());
            ctx.setStatus(200);
        } else if (action.equals("getList")) {
            String field = ctx.getParameter("field");

            if (field.equalsIgnoreCase("source"))
                getList(ctx, "NutritionSources", "Name");
            else
                getList(ctx, "NutritionTypes", "Name");
        } else if (action.equals("addListItem")) {
            String           field   = ctx.getParameter("field");
            String           table   = field.equalsIgnoreCase("source")? "NutritionSources" : "NutritionTypes";
            SQLInsertBuilder sql = ctx.getInsertBuilder(table);
            
            sql.addField("Name", ctx.getParameter("item"));
            executeUpdate(ctx, sql);
            ctx.setStatus(200);
        } else if (action.equals("createevent")) {
            Date   timestamp   = ctx.getTimestamp("crdate", "crtime");
            String description = ctx.getParameter("crdescription");
            String comment     = ctx.getParameter("crcomment");
            String weight      = ctx.getParameter("crweight");

            if (eventFor(ctx, timestamp)) {
                ctx.getReplyBuffer().append("Change time as event already recorded for " + timestamp);
            } else {
                SQLInsertBuilder sql = ctx.getInsertBuilder("NutritionEvent");

                sql.addField("Timestamp",   ctx.getDbTimestamp(timestamp));
                sql.addField("Description", description);
                sql.addField("Comment",     comment);
                executeUpdate(ctx, sql);
            }
            updateWeight(ctx, timestamp, weight);
            ctx.setStatus(200);
        } else if (action.equals("updateevent")) {
            Date   timestamp   = ctx.getTimestamp("date", "time");
            String description = ctx.getParameter("description");
            String comment     = ctx.getParameter("comment");

            SQLUpdateBuilder sql = ctx.getUpdateBuilder("NutritionEvent");

            sql.addField("Description", description);
            sql.addField("Comment",     comment);
            sql.addAnd("Timestamp", "=", timestamp);
            executeUpdate(ctx, sql);
            ctx.setStatus(200);
        } else if (action.equals("copyevent")) {
            Date   sTimestamp   = ctx.getTimestamp("sdate", "stime");
            Date   cTimestamp   = ctx.getTimestamp("cdate", "ctime");
            String cDescription = ctx.getParameter("cdescription");
            String cComment     = ctx.getParameter("ccomment");

            if (eventFor(ctx, cTimestamp)) {
                ctx.getReplyBuffer().append("Change time as event already recorded for " + cTimestamp);
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
            }
            updateWeight(ctx, cTimestamp, ctx.getParameter("cweight"));
            ctx.setStatus(200);
        } else if (action.equals("deleteevent")) {
            Date             timestamp = ctx.getTimestamp("date", "time");
            SQLDeleteBuilder sql       = ctx.getDeleteBuilder("NutritionRecord");

            sql.addAnd("Timestamp", "=", timestamp);
            executeUpdate(ctx, sql.build());
            sql.setTable("NutritionEvent");
            executeUpdate(ctx, sql.build());
            
            ctx.setStatus(200);
        } else if (action.equals("deleteitem")) {
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
        } else if (action.equals("modifyitem")) {
            Date  timestamp    = ctx.getTimestamp("date", "time");
            String item        = ctx.getParameter("item");
            String source      = ctx.getParameter("source");
            String description = ctx.getParameter("description");
            String quantity    = ctx.getParameter("quantity");
            String abv         = ctx.getParameter("abv");

            SQLSelectBuilder sql = ctx.getSelectBuilder("NutritionEvent");

            sql.addField("Timestamp");
            sql.addField("Description");
            sql.addAnd("Timestamp", "=", timestamp);

            ResultSet rs = updateQuery(ctx, sql.build());

            if (rs.next()) {
                rs.moveToCurrentRow();
                rs.updateString("Description", description);
                rs.updateRow();
            } else {
                rs.moveToInsertRow();
                rs.updateString("Timestamp",   ctx.getDbTimestamp(timestamp));
                rs.updateString("Description", description);
                rs.insertRow();
            }
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

            if (rs.next()) {
                rs.moveToCurrentRow();
                rs.updateString("Quantity", quantity);

                if (abv.length() != 0) {
                    rs.updateString("ABV", abv);
                }
                rs.updateRow();
            } else {
                rs.moveToInsertRow();
                rs.updateString("Timestamp",   ctx.getDbTimestamp(timestamp));
                rs.updateString("Item",        item);
                rs.updateString("Source",      source);
                rs.updateString("Quantity",    quantity);
                rs.updateString("IsComposite", ctx.getParameter("simple").equalsIgnoreCase("c")? "Y" :"N");

                if (abv.length() != 0) {
                    rs.updateString("ABV", abv);
                }
                rs.insertRow();
            }
            ctx.setStatus(200);
        } else if (action.equals("getactiveevent")) {
            JSONObject       data      = new JSONObject();
            Date             timestamp = ctx.getTimestamp("date", "time");
            SQLSelectBuilder sql       = ctx.getSelectBuilder(null);

            sql.addField("Item");
            sql.addDefaultedField("ABV",       0, 1);
            sql.addDefaultedField("Quantity",  0, 1);
            sql.addDefaultedField("Source",    "");
            sql.addDefaultedField("Type",      "");
            sql.addDefaultedField("Calories",  0, 0);
            sql.addDefaultedField("Saturated", 0, 1);
            sql.addDefaultedField("Sugar",     0, 1);
            sql.addDefaultedField("Salt",      0, 1);
            sql.setOrderBy("Item");

            sql.setFrom("NutritionRecordFull");
            sql.addAnd("Timestamp", "=", timestamp);

            ResultSet rs = executeQuery(ctx, sql);
            data.add("ItemDetails", rs);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("checktimestamp")) {
            Date timestamp = ctx.getTimestamp("date", "time");

            if (eventFor(ctx, timestamp)) {
                ctx.getReplyBuffer().append("Change time as event already recorded for " + ctx.getDbTimestamp(timestamp));
            }
            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid");
        }
    }
}