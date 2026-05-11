using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using MySql.Data.MySqlClient;

namespace Warehouse_Management
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
        }

        private void button_login_Click(object sender, EventArgs e)
        {
            string empID = u_name.Text.Trim();
            string emppassword = password.Text.Trim();

            if (string.IsNullOrEmpty(empID) || string.IsNullOrEmpty(emppassword))
            {
                MessageBox.Show("Please enter Employee ID and Password");
                return;
            }

            using (MySqlConnection conn = DbHelper.GetWarehouseConnection())
            {
                try
                {
                    conn.Open();

                    string query = "SELECT COUNT(*) FROM users WHERE u_name=@name AND pass=@pass";
                    using (MySqlCommand cmd = new MySqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@name", empID);
                        cmd.Parameters.AddWithValue("@pass", emppassword);

                        int count = Convert.ToInt32(cmd.ExecuteScalar());

                        if (count > 0)
                        {
                            MessageBox.Show("Successfully Logged in - Welcome, " + u_name.Text.ToUpper() + "!");
                            Dashboard dash = new Dashboard(empID); // pass username here
                            dash.Show();
                            this.Hide();
                        }
                        else
                        {
                            MessageBox.Show("Invalid Employee ID or Password");
                        }
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Database error: " + ex.Message);
                }
            }
        }

        private void Form1_Load(object sender, EventArgs e) { }
        private void lblTitle_Click(object sender, EventArgs e) { }
        private void label1_Click(object sender, EventArgs e) { }
    }
}