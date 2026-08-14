import type {
  HomeSearchCarMetric,
  HomeSearchClientField,
  HomeSearchFactoryMetric,
  HomeSearchFactoryStatus,
  HomeSearchRouteMetric,
} from './HomeSearchTypes';

export type HomeSearchBusinessIntentMatch = {
  alias: string;
  carMetric?: HomeSearchCarMetric;
  clientField?: HomeSearchClientField;
  factoryMetric?: HomeSearchFactoryMetric;
  factoryPaymentDateUnsupported?: boolean;
  factoryStatus?: HomeSearchFactoryStatus;
  periodSummary?: true;
  routeMetric?: HomeSearchRouteMetric;
};

const INTENT_DEFINITIONS: HomeSearchBusinessIntentMatch[] = [
  {
    alias: 'pagamentos realizados em',
    factoryMetric: 'payments',
    factoryPaymentDateUnsupported: true,
  },
  {
    alias: 'pagamentos pagos em',
    factoryMetric: 'payments',
    factoryPaymentDateUnsupported: true,
  },
  {
    alias: 'parcelas pagas em',
    factoryMetric: 'payments',
    factoryPaymentDateUnsupported: true,
  },
  { alias: 'pagamentos das compras de', factoryMetric: 'payments' },
  {
    alias: 'pagamentos parciais fabrica',
    factoryMetric: 'payments',
    factoryStatus: 'partial',
  },
  { alias: 'compras da fabrica', factoryMetric: 'purchases' },
  { alias: 'baldes comprados', factoryMetric: 'bucketsPurchased' },
  { alias: 'valor comprado', factoryMetric: 'purchaseValue' },
  { alias: 'pagamentos fabrica', factoryMetric: 'payments' },
  {
    alias: 'pago fabrica',
    factoryMetric: 'paidValue',
    factoryStatus: 'paid',
  },
  {
    alias: 'a pagar fabrica',
    factoryMetric: 'openValue',
    factoryStatus: 'outstanding',
  },
  {
    alias: 'em aberto fabrica',
    factoryMetric: 'openValue',
    factoryStatus: 'open',
  },
  { alias: 'compras fabrica', factoryMetric: 'purchases' },
  { alias: 'compra fabrica', factoryMetric: 'purchases' },
  { alias: 'valor do balde', clientField: 'currentPrice' },
  { alias: 'preco', clientField: 'currentPrice' },
  { alias: 'endereco', clientField: 'address' },
  { alias: 'autonomia gasolina', carMetric: 'gasolineAutonomy' },
  { alias: 'autonomia alcool', carMetric: 'alcoholAutonomy' },
  { alias: 'consumo carro', carMetric: 'consumption' },
  { alias: 'quilometragem', routeMetric: 'distance' },
  { alias: 'km', routeMetric: 'distance' },
  { alias: 'rota', routeMetric: 'routes' },
  { alias: 'dados do dia', periodSummary: true },
  { alias: 'resumo', periodSummary: true },
];

const INTENTS = INTENT_DEFINITIONS.sort((left, right) => right.alias.length - left.alias.length);

export function matchHomeSearchBusinessIntent(
  normalized: string,
): HomeSearchBusinessIntentMatch | undefined {
  return INTENTS.find(({ alias }) => {
    const index = normalized.indexOf(alias);
    if (index < 0) return false;
    const before = normalized[index - 1];
    const after = normalized[index + alias.length];
    return (!before || before === ' ') && (!after || after === ' ');
  });
}
