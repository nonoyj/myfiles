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
    public partial class Dashboard : Form
    {
        int selectedProductId = 0;
        string currentUsername = "";

        public Dashboard(string username)
        {
            InitializeComponent();
            currentUsername = username;
        }

        private void Dashboard_Load(object sender, EventArgs e)
        {
            LoadData();
            dataGridView1.DataError -= dataGridView1_DataError;
            dataGridView1.DataError += dataGridView1_DataError;
        }

        private void dataGridView1_DataError(object sender, DataGridViewDataErrorEventArgs e)
        {
            e.ThrowException = false;
            MessageBox.Show("Invalid data format in grid. Check numeric fields (Price, Quantity) and try again.");
        }

        void ClearFields()
        {
            product_name.Text = "";
            category1.SelectedItem = null;
            price.Text = "";
            quantity.Text = "";
            selectedProductId = 0;
            lblAddedBy.Text = "";
        }

        private void clear_Click(object sender, EventArgs e)
        {
            ClearFields();
        }

        void LoadData()
        {
            using (MySqlConnection conn = DbHelper.GetWarehouseConnection())
            {
                try
                {
                    conn.Open();
                    string query = "SELECT ProductID, ProductName, Category, Price, Quantity, " +
                                   "CASE " +
                                   "  WHEN AddedBy IS NOT NULL AND LastUpdatedBy IS NOT NULL " +
                                   "    THEN CONCAT('Added by: ', AddedBy, ' - Last updated by: ', LastUpdatedBy) " +
                                   "  WHEN AddedBy IS NOT NULL " +
                                   "    THEN CONCAT('Added by: ', AddedBy) " +
                                   "  ELSE '' " +
                                   "END AS History " +
                                   "FROM warehouse";

                    using (MySqlDataAdapter adapter = new MySqlDataAdapter(query, conn))
                    {
                        DataTable dt = new DataTable();
                        adapter.Fill(dt);
                        dataGridView1.DataSource = dt;
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Error: " + ex.Message);
                }
            }
        }

        bool ValidateInputs(out decimal priceValue, out int quantityValue)
        {
            if (product_name.Text == "" || category1.SelectedItem == null || price.Text == "" || quantity.Text == "")
            {
                MessageBox.Show("Please fill in all fields.");
                priceValue = 0;
                quantityValue = 0;
                return false;
            }

            if (!decimal.TryParse(price.Text, out priceValue))
            {
                MessageBox.Show("Invalid price value.");
                quantityValue = 0;
                return false;
            }

            if (!int.TryParse(quantity.Text, out quantityValue))
            {
                MessageBox.Show("Invalid quantity value.");
                return false;
            }

            return true;
        }

        private void add_Click(object sender, EventArgs e)
        {
            if (!ValidateInputs(out decimal priceValue, out int quantityValue))
                return;

            try
            {
                using (MySqlConnection conn = DbHelper.GetWarehouseConnection())
                {
                    conn.Open();

                    string query = "INSERT INTO warehouse (ProductName, Category, Price, Quantity, AddedBy) " +
                                   "VALUES (@ProductName, @Category, @Price, @Quantity, @AddedBy)";

                    using (MySqlCommand cmd = new MySqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@ProductName", product_name.Text);
                        cmd.Parameters.AddWithValue("@Category", category1.SelectedItem?.ToString() ?? string.Empty);
                        cmd.Parameters.AddWithValue("@Price", priceValue);
                        cmd.Parameters.AddWithValue("@Quantity", quantityValue);
                        cmd.Parameters.AddWithValue("@AddedBy", currentUsername);

                        cmd.ExecuteNonQuery();
                    }
                }

                MessageBox.Show("Product added!");
                LoadData();
                ClearFields();
            }
            catch (MySqlException mex)
            {
                MessageBox.Show("Database error: " + mex.Message + "\n\nCheck your connection string, MySQL user privileges, and that the MySQL connector supports your server's authentication plugin (caching_sha2_password).\n" +
                                "For development you can try adding 'AllowPublicKeyRetrieval=True;SslMode=None;' to the connection string or use MySqlConnector/MySql.Data v8+.");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Unexpected error: " + ex.Message);
            }
        }

        private void dataGridView1_CellClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex >= 0)
            {
                DataGridViewRow row = dataGridView1.Rows[e.RowIndex];

                object idVal = row.Cells["ProductID"].Value;
                selectedProductId = (idVal == null || idVal == DBNull.Value) ? 0 : Convert.ToInt32(idVal);

                object nameVal = row.Cells["ProductName"].Value;
                product_name.Text = (nameVal == null || nameVal == DBNull.Value) ? string.Empty : nameVal.ToString();

                object catVal = row.Cells["Category"].Value;
                category1.SelectedItem = (catVal == null || catVal == DBNull.Value) ? null : catVal.ToString();

                object priceVal = row.Cells["Price"].Value;
                price.Text = (priceVal == null || priceVal == DBNull.Value) ? string.Empty : priceVal.ToString();

                object qtyVal = row.Cells["Quantity"].Value;
                quantity.Text = (qtyVal == null || qtyVal == DBNull.Value) ? string.Empty : qtyVal.ToString();

                object historyVal = row.Cells["History"].Value;
                lblAddedBy.Text = (historyVal == null || historyVal == DBNull.Value || historyVal.ToString() == "")
                    ? "No History available."
                    : historyVal.ToString();
            }
        }

        private void update_Click(object sender, EventArgs e)
        {
            if (selectedProductId == 0)
            {
                MessageBox.Show("Select a product first.");
                return;
            }

            if (!ValidateInputs(out decimal priceValue, out int quantityValue))
                return;

            try
            {
                using (MySqlConnection conn = DbHelper.GetWarehouseConnection())
                {
                    conn.Open();

                    string query = "UPDATE warehouse SET ProductName=@ProductName, Category=@Category, " +
                                   "Price=@Price, Quantity=@Quantity, LastUpdatedBy=@LastUpdatedBy " +
                                   "WHERE ProductID=@ProductID";

                    using (MySqlCommand cmd = new MySqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@ProductName", product_name.Text);
                        cmd.Parameters.AddWithValue("@Category", category1.SelectedItem?.ToString() ?? string.Empty);
                        cmd.Parameters.AddWithValue("@Price", priceValue);
                        cmd.Parameters.AddWithValue("@Quantity", quantityValue);
                        cmd.Parameters.AddWithValue("@LastUpdatedBy", currentUsername);
                        cmd.Parameters.AddWithValue("@ProductID", selectedProductId);

                        cmd.ExecuteNonQuery();
                    }
                }

                MessageBox.Show("Product updated!");
                LoadData();
                ClearFields();
            }
            catch (MySqlException mex)
            {
                MessageBox.Show("Database error: " + mex.Message + "\n\nCheck your connection string and connector.");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Unexpected error: " + ex.Message);
            }
        }

        private void delete_Click(object sender, EventArgs e)
        {
            if (selectedProductId == 0)
            {
                MessageBox.Show("Select a product first.");
                return;
            }

            try
            {
                using (MySqlConnection conn = DbHelper.GetWarehouseConnection())
                {
                    conn.Open();

                    string query = "DELETE FROM warehouse WHERE ProductID=@ProductID";
                    using (MySqlCommand cmd = new MySqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@ProductID", selectedProductId);
                        cmd.ExecuteNonQuery();
                    }
                }

                MessageBox.Show("Product deleted!");
                LoadData();
                ClearFields();
            }
            catch (MySqlException mex)
            {
                MessageBox.Show("Database error: " + mex.Message + "\n\nCheck your connection string and connector.");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Unexpected error: " + ex.Message);
            }
        }

        private void log_out_Click(object sender, EventArgs e)
        {
            MessageBox.Show("Logging Out...");
            Form1 back = new Form1();
            back.Show();
            this.Close();
        }

        private void quantity_TextChanged(object sender, EventArgs e) { }
        private void price_TextChanged(object sender, EventArgs e) { }
        private void category_TextChanged(object sender, EventArgs e) { }
        private void product_name_TextChanged(object sender, EventArgs e) { }
        private void quantity_label_Click(object sender, EventArgs e) { }
        private void price_label_Click(object sender, EventArgs e) { }
        private void product_name_label_Click(object sender, EventArgs e) { }
        private void category_label_Click(object sender, EventArgs e) { }
        private void dataGridView1_CellContentClick(object sender, DataGridViewCellEventArgs e) { }
        private void category_SelectedIndexChanged(object sender, EventArgs e) { }

        private void lblAddedBy_Click(object sender, EventArgs e)
        {

        }
    }
}
