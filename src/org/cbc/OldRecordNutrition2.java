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
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.sql.SQLInsertBuilder;
import org.cbc.sql.SQLSelectBuilder;
import org.cbc.sql.SQLUpdateBuilder;

/**
 *
 * @author Chris
 */
public class OldRecordNutrition2 extends ApplicationServerOld {
    
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
    private boolean eventFor(Context ctx, String timestamp) throws SQLException {
        ResultSet rs = executeQuery(ctx, "SELECT Timestamp FROM NutritionEvent WHERE Timestamp = '" + timestamp + "'");
             
        return rs.next();
    }
    private String getWeight(Context ctx, String date) throws SQLException {
        SQLSelectBuilder sql = new SQLSelectBuilder("Weight");
        
        sql.addField("Kilos");
        sql.setWhere("Date = '" + date + "'");
        
        ResultSet rs = updateQuery(ctx, sql.build());
                
        if (rs.next()) return rs.getString("Kilos");
        
        return "";
    }
    private void updateWeight(Context ctx, String date, String time, String weight) throws SQLException {
        SQLSelectBuilder sql  = new SQLSelectBuilder("Weight");
        
        sql.addField("Date");
        sql.addField("Time");
        sql.addField("Kilos");
        
        sql.setWhere("Date = '" + date + "'");
        
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
            rs.updateString("Date",  date);
            rs.updateString("Time",  time);
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
        
        setNumericItemField(rs, "Calories",      ctx.getParameter("calories"),     scale);
        setNumericItemField(rs, "Protein",       ctx.getParameter("protein"),      scale);
        setNumericItemField(rs, "Cholesterol",   ctx.getParameter("cholesterol"),  scale);
        setNumericItemField(rs, "Fat",           ctx.getParameter("fat"),          scale);
        setNumericItemField(rs, "Saturated",     ctx.getParameter("saturated"),    scale);
        setNumericItemField(rs, "Carbohydrates", ctx.getParameter("carbohydrate"), scale);
        setNumericItemField(rs, "Sugar",         ctx.getParameter("sugar"),        scale);
        setNumericItemField(rs, "Fibre",         ctx.getParameter("fibre"),        scale);
        setNumericItemField(rs, "Salt",          ctx.getParameter("salt"),         scale);
        setNumericItemField(rs, "ABV",           ctx.getParameter("abv"),          1);
        
        if (simple) setNumericItemField(rs, "DefaultSize", ctx.getParameter("default"), 1);
    }
    public String getVersion() {        
        return "V1.0 Released 15-Jul-2014 14:57";    
    }
    public void initApplication (ServletConfig config) throws ServletException{
        
    }
    public void processAction(
            Context ctx,
            String  action) throws ServletException, IOException, SQLException, JSONException, ParseException {

        if (action.equals("getweight")) {
            String date = ctx.getParameter("date");

            ctx.getReplyBuffer().append(getWeight(ctx, date));
            ctx.setStatus(200);
        } else if (action.equals("getitem")) {
            SQLSelectBuilder sql = new SQLSelectBuilder("NutritionDetail");

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

            sql.addAnd("SeqNo", "=", ctx.getParameter("seqno"));
            JSONArray fields = new JSONArray();
            ResultSet rs     = executeQuery(ctx, sql);

            fields.addFields(rs);
            fields.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("applyitemupdate")) {
            String    seqNo = ctx.getParameter("seqno");
            ResultSet rs;

            ctx.getDb().startTransaction();

            if (seqNo.length() == 0) {
                rs = ctx.getDb().insertTable("NutritionDetail");
                rs.moveToInsertRow();
                setItemFields(ctx, rs);
                rs.insertRow();
                ctx.setStatus(200);
            } else {
                rs = updateQuery(ctx, "SELECT * FROM NutritionDetail WHERE SeqNo = " + seqNo);

                if (!rs.next()) {
                    ctx.getReplyBuffer().append("No record for SeqNo " + seqNo);
                } else {
                    rs.moveToCurrentRow();
                    setItemFields(ctx, rs);
                    rs.updateRow();
                    ctx.setStatus(200);
                }
            }
            rs.close();
            ctx.getDb().commit();
        } else if (action.equals("eventhistory")) {
            JSONObject       data = new JSONObject();
            SQLSelectBuilder sql  = new SQLSelectBuilder("NutritionEventSummary");

            sql.setProtocol(ctx.getDb().getProtocol());
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

            ResultSet rs = executeQuery(ctx, sql.build());
            data.add("ItemDetails", rs);
            data.append(ctx.getReplyBuffer());
            ctx.setStatus(200);
        } else if (action.equals("getList")) {
            JSONObject data  = new JSONObject();
            String     field = ctx.getParameter("name");
            ResultSet  rs    = executeQuery(ctx, getListSql("NutritionDetail", field, ctx.getParameter("filter")));

            data.add(field, rs);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("createevent")) {
            String timestamp   = ctx.getParameter("crdate") + ' ' + ctx.getParameter("crtime");
            String description = ctx.getParameter("crdescription");
            String comment     = ctx.getParameter("crcomment");
            String weight      = ctx.getParameter("crweight");

            if (eventFor(ctx, timestamp)) {
                ctx.getReplyBuffer().append("Change time as event already recorded for " + timestamp);
            } else {
                SQLInsertBuilder sql = new SQLInsertBuilder("NutritionEvent");

                sql.addField("Timestamp",   timestamp);
                sql.addField("Description", description);
                sql.addField("Comment",     comment);
                executeUpdate(ctx, sql);
            }
            updateWeight(ctx, ctx.getParameter("crdate"), ctx.getParameter("crtime"), weight);
            ctx.setStatus(200);
        } else if (action.equals("updateevent")) {
            String timestamp   = ctx.getParameter("date") + ' ' + ctx.getParameter("time");
            String description = ctx.getParameter("description");
            String comment     = ctx.getParameter("comment");

            SQLUpdateBuilder sql = new SQLUpdateBuilder("NutritionEvent");

            sql.addField("Description", description);
            sql.addField("Comment",     comment);
            sql.setWhere("Timestamp = '" + timestamp + "'");
            executeUpdate(ctx, sql);
            ctx.setStatus(200);
        } else if (action.equals("copyevent")) {
            String sTimestamp   = ctx.getParameter("sdate") + ' ' + ctx.getParameter("stime");
            String cTimestamp   = ctx.getParameter("cdate") + ' ' + ctx.getParameter("ctime");
            String cDescription = ctx.getParameter("cdescription");
            String cComment     = ctx.getParameter("ccomment");

            if (eventFor(ctx, cTimestamp)) {
                ctx.getReplyBuffer().append("Change time as event already recorded for " + cTimestamp);
            } else {
                SQLInsertBuilder sql = new SQLInsertBuilder("NutritionEvent");

                sql.addField("Timestamp",   cTimestamp);
                sql.addField("Description", cDescription);
                sql.addField("Comment",     cComment);
                executeUpdate(ctx, sql);
                executeUpdate(ctx,
                        "INSERT NutritionRecord "
                        + "SELECT '" + cTimestamp + "', Detail, Quantity, ABV "
                        + "FROM   NutritionRecord "
                        + "WHERE Timestamp = ' " + sTimestamp + "'");
            }
            updateWeight(ctx, ctx.getParameter("cdate"), ctx.getParameter("ctime"), ctx.getParameter("cweight"));
            ctx.setStatus(200);
        } else if (action.equals("deleteevent")) {
            String timestamp = ctx.getParameter("date") + ' ' + ctx.getParameter("time");

            executeUpdate(ctx, "DELETE FROM NutritionRecord WHERE Timestamp = '" + timestamp + "'");
            executeUpdate(ctx, "DELETE FROM NutritionEvent  WHERE Timestamp = '" + timestamp + "'");

            ctx.setStatus(200);
        } else if (action.equals("deleteitem")) {
            String        seqNo     = ctx.getParameter("seqno");
            String        timestamp = ctx.getParameter("date") + ' ' + ctx.getParameter("time");
            StringBuilder sql       = new StringBuilder();

            sql.append("DELETE FROM NutritionRecord WHERE Timestamp = '" + timestamp + "' AND Detail = " + seqNo);
            executeUpdate(ctx, sql.toString());

            ctx.setStatus(200);
        } else if (action.equals("modifyitem")) {
            String seqNo       = ctx.getParameter("seqno");
            String timestamp   = ctx.getParameter("date") + ' ' + ctx.getParameter("time");
            String description = ctx.getParameter("description");
            String quantity    = ctx.getParameter("quantity");
            String abv         = ctx.getParameter("abv");

            SQLSelectBuilder sql = new SQLSelectBuilder("NutritionEvent");

            sql.addField("Timestamp");
            sql.addField("Description");
            sql.setWhere("Timestamp = '" + timestamp + "'");

            ResultSet rs = updateQuery(ctx, sql.build());

            if (rs.next()) {
                rs.moveToCurrentRow();
                rs.updateString("Description", description);
                rs.updateRow();
            } else {
                rs.moveToInsertRow();
                rs.updateString("Timestamp",   timestamp);
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
                rs.updateString("Timestamp", timestamp);
                rs.updateString("Detail",    seqNo);
                rs.updateString("Quantity",  quantity);

                if (abv.length() != 0) {
                    rs.updateString("ABV", abv);
                }
                rs.insertRow();
            }
            ctx.setStatus(200);
        } else if (action.equals("getactiveevent")) {
            JSONObject       data      = new JSONObject();
            String           timestamp = ctx.getParameter("date") + ' ' + ctx.getParameter("time");
            SQLSelectBuilder sql       = new SQLSelectBuilder();

            sql.addField("ND.SeqNo", "SeqNo");
            sql.addField("ND.Item",  "Item");
            sql.addDefaultedField("NR.ABV",      "ABV",      0);
            sql.addDefaultedField("NR.Quantity", "Quantity", 0);
            sql.addDefaultedField("ND.Source",   "Source",   "");
            sql.addDefaultedField("ND.Type",     "Type",     "");
            sql.addDefaultedField("ND.Simple",   "Simple",   "");
            sql.addDefaultedField("NR.Quantity * ND.Salt",   "Salt", 0, 3);
            sql.setOrderBy("ND.Item");

            sql.setFrom("NutritionRecord NR JOIN NutritionDetail ND ON NR.Detail = ND.SeqNo");
            sql.setWhere("NR.Timestamp = '" + timestamp + "'");

            ResultSet rs = executeQuery(ctx, sql);
            data.add("ItemDetails", rs);
            data.append(ctx.getReplyBuffer());

            ctx.setStatus(200);
        } else if (action.equals("checktimestamp")) {
            String timestamp = ctx.getParameter("date") + ' ' + ctx.getParameter("time");

            if (eventFor(ctx, timestamp)) {
                ctx.getReplyBuffer().append("Change time as event already recorded for " + timestamp);
            }
            ctx.setStatus(200);
        } else {
            ctx.dumpRequest("Action " + action + " is invalid");
            ctx.getReplyBuffer().append("Action " + action + " is invalid");
        }
    }
}