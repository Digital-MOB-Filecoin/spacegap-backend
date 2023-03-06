export type ApplicationConfig = {
  mongo: {
    url: string,
    database: string,
  },
  app: {
    port: number,
    filecoinRpcUrl: string,
  }
}

export const config: ApplicationConfig =  {
  mongo: {
    url: process.env.MONGO_DB_URL,
    database: process.env.MONGO_DB_DATABASE,
  },
  app: {
    port: parseInt(process.env.PORT),
    filecoinRpcUrl: process.env.FILECOIN_RPC_URL,
  }
}
