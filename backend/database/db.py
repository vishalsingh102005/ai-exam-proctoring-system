import os
import pymysql
import sqlite3
from backend.config import Config

class DatabaseManager:
    def __init__(self):
        self.engine = 'sqlite'
        self.connection_config = {
            'host': Config.DB_HOST,
            'user': Config.DB_USER,
            'password': Config.DB_PASSWORD,
            'port': int(Config.DB_PORT),
            'charset': 'utf8mb4',
            'cursorclass': pymysql.cursors.DictCursor
        }
        self.db_name = Config.DB_NAME
        self.sqlite_path = Config.SQLITE_DB_PATH
        
        # Test connection and initialize
        self.init_db()

    def get_connection(self):
        """
        Returns a connection object.
        For MySQL: a pymysql Connection.
        For SQLite: a sqlite3 Connection.
        """
        if self.engine == 'mysql':
            try:
                conn = pymysql.connect(
                    host=self.connection_config['host'],
                    user=self.connection_config['user'],
                    password=self.connection_config['password'],
                    database=self.db_name,
                    port=self.connection_config['port'],
                    charset=self.connection_config['charset'],
                    cursorclass=self.connection_config['cursorclass'],
                    autocommit=True
                )
                return conn
            except Exception as e:
                print(f"[DB] MySQL connection lost, falling back to SQLite. Error: {e}")
                self.engine = 'sqlite'
                
        # SQLite Connection
        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row  # Return dict-like results
        return conn

    def execute_query(self, query, params=None):
        """
        Execute a query (INSERT, UPDATE, DELETE) and return affected row count or last insert ID.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        query = self._format_query(query)
        params = params or ()
        
        last_id = None
        try:
            if self.engine == 'mysql':
                cursor.execute(query, params)
                last_id = cursor.lastrowid
            else:
                cursor.execute(query, params)
                conn.commit()
                last_id = cursor.lastrowid
            return last_id
        except Exception as e:
            print(f"[DB ERROR] Query: {query} | Params: {params} | Error: {e}")
            raise e
        finally:
            cursor.close()
            conn.close()

    def fetch_all(self, query, params=None):
        """
        Fetch all records for a query.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        query = self._format_query(query)
        params = params or ()
        try:
            cursor.execute(query, params)
            if self.engine == 'mysql':
                return cursor.fetchall()
            else:
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"[DB ERROR] Query: {query} | Params: {params} | Error: {e}")
            raise e
        finally:
            cursor.close()
            conn.close()

    def fetch_one(self, query, params=None):
        """
        Fetch a single record for a query.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        query = self._format_query(query)
        params = params or ()
        try:
            cursor.execute(query, params)
            row = cursor.fetchone()
            if row is None:
                return None
            if self.engine == 'mysql':
                return row
            else:
                return dict(row)
        except Exception as e:
            print(f"[DB ERROR] Query: {query} | Params: {params} | Error: {e}")
            raise e
        finally:
            cursor.close()
            conn.close()

    def _format_query(self, query):
        """
        Translates %s placeholder from MySQL format to SQLite ? format if SQLite is used.
        """
        if self.engine == 'sqlite':
            # Replace MySQL's INT AUTO_INCREMENT to SQLite format if executing table creation
            query = query.replace('INT AUTO_INCREMENT PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
            query = query.replace('TINYINT(1)', 'INTEGER')
            query = query.replace('TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            query = query.replace('%s', '?')
        return query

    def init_db(self):
        """
        Check if MySQL is reachable and initialize the database. If not, fallback to SQLite.
        """
        Config.init_app()
        try:
            # Try to connect to MySQL database server (without specifying DB name first)
            conn = pymysql.connect(
                host=self.connection_config['host'],
                user=self.connection_config['user'],
                password=self.connection_config['password'],
                port=self.connection_config['port']
            )
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {self.db_name}")
            cursor.close()
            conn.close()
            
            self.engine = 'mysql'
            print("[DB] MySQL database detected and verified successfully.")
        except Exception as e:
            print(f"[DB] MySQL is unavailable. Falling back to local SQLite database. Reason: {e}")
            self.engine = 'sqlite'

        # Execute schema migration
        self._run_schema_sql()

    def _run_schema_sql(self):
        """
        Reads schema.sql and runs it in the active database connection.
        """
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        if not os.path.exists(schema_path):
            print(f"[DB] schema.sql not found at {schema_path}!")
            return

        with open(schema_path, 'r') as f:
            sql_script = f.read()

        conn = self.get_connection()
        cursor = conn.cursor()
        
        # SQLite and MySQL handle multiple statements differently. Let's split them.
        statements = sql_script.split(';')
        for stmt in statements:
            stmt = stmt.strip()
            if not stmt:
                continue
            
            formatted_stmt = self._format_query(stmt)
            try:
                cursor.execute(formatted_stmt)
            except Exception as e:
                # Ignore table already exists errors or print them
                print(f"[DB MIGRATION WARNING] Failed statement: {formatted_stmt[:60]}... | Error: {e}")
                
        if self.engine == 'sqlite':
            conn.commit()
        
        cursor.close()
        conn.close()
        print(f"[DB] Database schema migration executed successfully on {self.engine.upper()} engine.")

# Global DB client instance
db = DatabaseManager()
