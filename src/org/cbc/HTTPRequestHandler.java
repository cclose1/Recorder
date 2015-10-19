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
    public HttpServletResponse getResponse() {
        return response;
    }
    public void dumpRequest() {
        for (Enumeration e = request.getHeaderNames(); e.hasMoreElements();) {
            String name = (String) e.nextElement();
            
            dumpLine(null, "Property " + name + "=" + request.getHeader(name));
        }
        for (Enumeration e = request.getParameterNames(); e.hasMoreElements();) {
            String parameter = (String) e.nextElement();
            
            dumpLine(null, "Parameter " + parameter + "= " + request.getParameter(parameter));
        }
    }
    public void dumpRequest(HttpServletResponse response, String reason) throws ServletException, IOException {

        PrintWriter out = response == null? null : response.getWriter();
        try {
            dumpLine(out, "Servlet Message " + request.getContextPath() + " fail reason " + reason);
            dumpLine(out, "Query String    " + request.getQueryString());

            for (Enumeration e = request.getParameterNames(); e.hasMoreElements();) {
                String parameter = (String) e.nextElement();
                dumpLine(out, "Parameter       " + parameter + "= " + request.getParameter(parameter));      
            }
        } finally {
            if (out != null) out.close();
        }
    }
    public void dumpRequest(String reason) throws ServletException, IOException {
        dumpRequest(response, reason);
    }
    public String getParameter(String name) {
        String value = request.getParameter(name);
        return value == null ? "" : value;
    }

    public String getCookie(String name) {
        if (request.getCookies() == null) return "";
        
        for (Cookie cookie : request.getCookies()) {
            if (cookie.getName().equals(name)) return cookie.getValue();
        }
        return "";
    }
}
