module.exports = {
  apps: [{
    name: 'roomreset-server',
    script: 'server.js',
    cwd: __dirname,
    env: {
      PORT: 3001,
      ROOMRESET_SPREADSHEET_ID: '1TCrSmXbHZnlltAJn1940vrMo_Z6z3PuLskcGPSQu7Yk',
      ROOMRESET_DRIVE_ROOT_FOLDER_ID: '1MLnHOfAWQTyeNGR24j_0suDaiF7sTBr4'
    }
  }]
};
