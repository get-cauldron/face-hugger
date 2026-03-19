pub mod schema;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool};
use std::path::Path;
use std::str::FromStr;

pub async fn init_db(app_data_dir: &Path) -> Result<SqlitePool, sqlx::Error> {
    let db_path = app_data_dir.join("uploads.db");
    let opts = SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.display()))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePool::connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
