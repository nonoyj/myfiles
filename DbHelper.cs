using System;
using System.Configuration;
using MySql.Data.MySqlClient;

namespace Warehouse_Management
{
    public static class DbHelper
    {
        
        public static string AuthConnectionString => "server=localhost;user=root;password=root;database=warehouse_login;AllowPublicKeyRetrieval=True;";

        public static string WarehouseConnectionString => "server=localhost;user=root;password=root;database=warehousemanagementsystem;AllowPublicKeyRetrieval=True;";

        public static MySqlConnection GetAuthConnection()
        {
            return new MySqlConnection(AuthConnectionString);
        }

        public static MySqlConnection GetWarehouseConnection()
        {
            return new MySqlConnection(WarehouseConnectionString);
        }
    }
}
