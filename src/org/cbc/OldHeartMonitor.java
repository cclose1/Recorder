/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbc;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.Properties;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.cbc.application.reporting.Report;
import org.cbc.application.reporting.Trace;
import org.cbc.application.reporting.Thread;
import org.cbc.application.reporting.Process;
import org.cbc.json.JSONArray;
import org.cbc.json.JSONException;
import org.cbc.json.JSONObject;
import org.cbc.json.JSONValue;
import org.cbc.utils.data.DatabaseSession;

/**
 *
 * @author Chris
 */
@WebServlet(name = "NewServletz", urlPatterns = {"/NewServletz"})
public class OldHeartMonitor extends HttpServlet {  
    private void dumpRequest(HttpServletRequest request) {

        for (Enumeration e = request.getParameterNames(); e.hasMoreElements();) {
            String parameter = (String) e.nextElement();
            System.out.println("Parameter " + parameter + "= " + request.getParameter(parameter));
        }
    }
    private void dumpRequest(HttpServletRequest request, HttpServletResponse response, String reason) throws ServletException, IOException {

        PrintWriter out = response.getWriter();
        try {
            out.println("<html>");
            out.println("<head>");
            out.println("<title>Servlet GetMessage</title>");
            out.println("</head>");
            out.println("<body>");
            out.println("<h1>Servlet GetMessage at " + request.getContextPath() + " fail reason " + reason + "</h1>");
            out.println("<h2>Query string " + request.getQueryString() + "</h2>");

            for (Enumeration e = request.getParameterNames(); e.hasMoreElements();) {
                String parameter = (String) e.nextElement();
                out.println("<h3>Parameter " + parameter + "= " + request.getParameter(parameter) + "</h3>");
            }
            out.println("</body>");
            out.println("</html>");
        } finally {
            out.close();
        }
    }
    private String getParameter(HttpServletRequest request, String name) {
        Trace t = new Trace("GetParameter");
        String value = request.getParameter(name);
        t.exit();
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
    private JSONObject toJSON(String table, ResultSet rs) throws SQLException, JSONException {
        JSONObject        tab   = new JSONObject();
        JSONArray         row;
        ArrayList<String> types = new ArrayList<String>();
        
        int columns = rs.getMetaData().getColumnCount();
        
        tab.add("Table", new JSONValue(table));
        row = tab.add("Header", (JSONArray)null);

        for (int i = 1; i <= columns; i++) {
            JSONObject col;
            String     type;
            
            col  = row.addObject();
            type = rs.getMetaData().getColumnTypeName(i);
            types.add(type);
            col.add("Name", new JSONValue(rs.getMetaData().getColumnName(i)));
            col.add("Type", new JSONValue(type));
        }
        row = tab.add("Data", (JSONArray)null);
        
        while (rs.next()) {
            JSONArray col = row.addArray();
            
            for (int i = 1; i <= columns; i++) {
                String value = rs.getString(i);
                
                if (value == null)
                    col.add(new JSONValue(value));
                else if (types.get(i - 1).equalsIgnoreCase("int"))                    
                    col.add(new JSONValue(rs.getInt(i)));
                else
                    col.add(new JSONValue(value.trim()));
            }
        }
        return tab;
    }
    protected void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
            Process.setConfigFile("C:\\Test\\ARConfig.cfg");
       
            Thread.attach("HeartMonitor");
            Trace t = new Trace("processRequest");
            response.setContentType("text/html;charset=UTF-8");
            Properties properties  = new Properties();
            properties.load(getServletContext().getResourceAsStream("/WEB-INF/record.properties"));
            
            DatabaseSession db          = new DatabaseSession();
            String          action      = getParameter(request, "action");
            String          server      = properties.getProperty("dbserver");
            String          database    = properties.getProperty("bpname");
            String          table       = properties.getProperty("bptable");
            String          user        = properties.getProperty("dbuser");
            String          password    = properties.getProperty("dbpassword");
            StringBuilder   replyBuffer = new StringBuilder();
                    
        try {
            Report.comment(null, "processRequest called with action " + action);
            t.report('C', "server " + server + " database " + database + " user " + user + " password " + password);
            /*
             * Assume failure, will be changed on a successful action.
             */
            response.setStatus(404);
            db.open(server, database, user, password);
            
            if (action.equals("")) {
                dumpRequest(request, response, "no action parameter");
            } else if (action.equals("save")) {
                ResultSet rs = db.insertTable(table);
                rs.moveToInsertRow();
                rs.updateString("Individual", getParameter(request, "identifier"));
                rs.updateString("Session",    getParameter(request, "session"));
                rs.updateString("Timestamp",  getParameter(request, "timestamp"));
                rs.updateString("Side",       getParameter(request, "side"));
                rs.updateString("Systolic",   getParameter(request, "systolic"));
                rs.updateString("Diastolic",  getParameter(request, "diastolic"));
                rs.updateString("Pulse",      getParameter(request, "pulse"));
                rs.updateString("Comment",    getParameter(request, "comment"));
                rs.insertRow();
                rs.close();
                response.setStatus(200);
            } else if (action.equals("history")) {
                JSONObject data;
                
                ResultSet rs = db.executeQuery(
                        "SELECT " + properties.getProperty("topmeasures") + 
                        " Individual, "                                         +
                        " Date, "                                               +
                        " Week, "                                               +
                        " Weekday, "                                            +
                        " CONVERT(VARCHAR(19), Session,   120) AS Session, "    +
                        " CONVERT(VARCHAR(19), Timestamp, 120) AS Timestamp, "  +
                        " Side, "                                               +
                        " Systolic, "                                           +
                        " Diastolic, "                                          +
                        " Pulse, "                                              +
                        " Comment "                                             +
                        " FROM " + table + 
                        " WHERE Individual = '" + getParameter(request, "identifier") + "'" + 
                        " ORDER BY Timestamp DESC");
                data = toJSON(table, rs);
                Report.comment(null, data.toString());
                data.append(replyBuffer);
                response.setStatus(200);
            } else {
                dumpRequest(request);
                response.sendError(404, "Action " + action + " is invalid");     
            }
        } catch (SQLException ex) {
            Report.error(null, ex.getMessage());
            response.sendError(404, ex.getMessage());
        } catch (JSONException ex) {
            Report.error(null, ex.getMessage());
            response.sendError(404, ex.getMessage());
        }
        response.getWriter().println(replyBuffer.toString());
        t.exit();
        Thread.detach();
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
