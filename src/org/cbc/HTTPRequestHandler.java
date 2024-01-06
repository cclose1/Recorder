/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package org.cbc;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Enumeration;
import javax.servlet.ServletException;
import javax.servlet.http.Cookie;
import org.cbc.application.reporting.Report;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 *
 * @author Chris
 */
public class HTTPRequestHandler {
    private HttpServletRequest  request;
    private HttpServletResponse response;
    
    private void dumpLine(PrintWriter out, String text) {
        if (out != null) out.println(text);
        
        Report.comment(null, text);
    }
    public HTTPRequestHandler(HttpServletRequest request) {
        this.request = request;
    }
    public HTTPRequestHandler(HttpServletRequest request, HttpServletResponse response) {
        this.request  = request;
        this.response = response;
    }
    public HttpServletRequest getRequest() {
        return request;
    }
    public HttpServletResponse getResponse() {
        return response;
    }
    private void outputRequest(PrintWriter out, boolean paramsOnly) {
        if (!paramsOnly) {
            for (Enumeration e = request.getHeaderNames(); e.hasMoreElements();) {
                String name = (String) e.nextElement();

                dumpLine(out, "Property " + name + "=" + request.getHeader(name));
            }
        }
        for (Enumeration e = request.getParameterNames(); e.hasMoreElements();) {
            String parameter = (String) e.nextElement();
            
            dumpLine(out, "Parameter " + parameter + "= " + request.getParameter(parameter));
        }        
    }
    public void dumpRequest() {
        outputRequest(null, false);
    }
    /*
     * Setting the response to null causes the dump to go to the comment stream only.
     * 
     * If the response is not null it is also written to response. On reflection this does not appear
     * to be particularly useful, particularly as it seems to cause subsequent setStatus calls to be ignored.
     */
    public void dumpRequest(HttpServletResponse response, String reason) throws ServletException, IOException {
        PrintWriter out = response == null? null : response.getWriter();
        try {
            dumpLine(out, "Servlet Message " + request.getContextPath() + " fail reason " + reason);
            dumpLine(out, "Query String    " + request.getQueryString());
            
            outputRequest(out, true);
        } finally {
            if (out != null) out.close();
        }
    }
    public void dumpRequest(String reason) throws ServletException, IOException {
        dumpRequest(response, reason);
    }
    public String getParameter(String name, String nullDefault) {
        String value = request.getParameter(name);
        return value == null || "".equals(value) ? nullDefault : value;
    }
    public String getParameter(String name) {
        return getParameter(name, "");
    }
    public boolean existsParameter(String name) {
        return getParameter(name, null) != null;
    }

    public Cookie getCookie(String name) {
        if (request.getCookies() == null) return null;
        
        for (Cookie cookie : request.getCookies()) {
            if (cookie.getName().equals(name)) return cookie;
        }
        return null;
    }
}
