package clinic.db;

import java.sql.Connection;
import java.sql.DriverManager;

public class DBConnection {

    private static final String REC_DB_URL   = "jdbc:mysql://localhost:3306/clinic_db";
    private static final String DB_USER      = "root";
    private static final String DB_PASSWORD  = "root";

    // ENCAPSULATION: constructor is private — nobody can do "new DBConnection()"
    private DBConnection() {}

       public static Connection getConnection() {
        try {
            Connection conn = DriverManager.getConnection(REC_DB_URL, DB_USER, DB_PASSWORD);
            System.out.println("DB Connected!");
            return conn;
        } catch (Exception e) {
            System.out.println("RECORDS DB ERROR: " + e.getMessage());
            return null;
        }
    }
}