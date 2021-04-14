import React from 'react';
import { useRouteMatch } from 'react-router';
import { Card, CardGrid, CardTitle } from 'src/components/layout/Card';
import { Spacer } from 'src/components/layout/Spacer';
import { StatItem } from 'src/components/StatItem';
import { TooltipContent, Tooltip } from 'src/components/Tooltip';
import {
  useActiveCoin,
  useActiveCoinTicker,
} from 'src/rdx/localSettings/localSettings.hooks';
import { useReduxState } from 'src/rdx/useReduxState';
import { fetchApi } from 'src/utils/fetchApi';
import { formatSi } from 'src/utils/si.utils';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import { dateUtils } from 'src/utils/date.utils';
import { useAsyncState } from 'src/hooks/useAsyncState';
import {
  ChartContainer,
  responsiveRule,
} from 'src/components/Chart/ChartContainer';
import { useActiveCoinTickerDisplayValue } from 'src/hooks/useDisplayReward';

export const MinerPplnsStats: React.FC<{
  averagePoolHashrate: number | null | undefined;
  poolHashrate: number | null | undefined;
}> = ({ averagePoolHashrate = 0, poolHashrate = 0 }) => {
  const { data: headerStatsData } = useReduxState('minerHeaderStats');

  const [shareLogLength, setShareLogLength] = React.useState(0);
  const {
    params: { address },
  } = useRouteMatch<{ address: string }>();
  const activeCoinTicker = useActiveCoinTicker();
  const activeCoin = useActiveCoin();

  const shareLogState = useAsyncState<number[]>();

  const approximateBlockShare = useActiveCoinTickerDisplayValue(
    headerStatsData?.approximateBlockShare,
    activeCoin,
    1000000
  );

  React.useEffect(() => {
    if (address && activeCoinTicker) {
      shareLogState.start(
        fetchApi<number[]>('/miner/shareLog', {
          query: {
            address: address,
            coin: activeCoinTicker,
          },
        })
      );
    }
    // eslint-disable-next-line
  }, [address, activeCoinTicker]);

  React.useEffect(() => {
    const data = shareLogState.data || [];

    if (data && data.length > 0) {
      var sharesDataTmp: {
        [key: string]: {
          number: string;
          other: number;
          your: number;
        };
      } = {};

      let totalShares = 0;
      let totalYour = 0;
      for (var i = 0; i < data.length; i++) {
        const item = data[i];
        if (item === 0) {
          continue;
        }
        for (var j = 0; j < item; j++) {
          if (!sharesDataTmp[`${Math.floor(totalShares / 10000)}`]) {
            sharesDataTmp[`${Math.floor(totalShares / 10000)}`] = {
              number: `${totalShares / 1000}k`,
              other: 0,
              your: 0,
            };
          }

          sharesDataTmp[`${Math.floor(totalShares / 10000)}`].other++;
          totalShares++;
        }

        if (!sharesDataTmp[`${Math.floor(totalShares / 10000)}`]) {
          continue;
        }

        sharesDataTmp[`${Math.floor(totalShares / 10000)}`].your++;
        // eslint-disable-next-line
        totalYour++;
        totalShares++;
      }

      setShareLogLength(totalShares);

      let sharesChart = am4core.create('shares-chart', am4charts.XYChart);

      sharesChart.responsive.enabled = true;
      sharesChart.responsive.useDefault = false;
      sharesChart.responsive.rules.push(responsiveRule);
      sharesChart.colors.list = [
        am4core.color('#0069ff'),
        am4core.color('#edb431'),
        am4core.color('#444444'),
      ];

      var sharesAxis = sharesChart.yAxes.push(new am4charts.ValueAxis());

      sharesAxis.numberFormatter = new am4core.NumberFormatter();
      sharesAxis.renderer.grid.template.disabled = true;

      let categoryAxis = sharesChart.xAxes.push(new am4charts.CategoryAxis());
      categoryAxis.dataFields.category = 'number';

      let yourSharesSeries = sharesChart.series.push(
        new am4charts.ColumnSeries()
      );

      yourSharesSeries.dataFields.categoryX = 'number';
      yourSharesSeries.name = 'Valid Shares';
      yourSharesSeries.yAxis = sharesAxis;
      yourSharesSeries.dataFields.valueY = 'your';
      yourSharesSeries.tooltipText = `{valueY} Shares ({roundShare}%)`;

      sharesChart.cursor = new am4charts.XYCursor();
      sharesChart.legend = new am4charts.Legend();

      const sharesDataTmpUnwrapped = Object.values(sharesDataTmp).map(
        (item) => ({
          ...item,
          roundShare: (item.your / (item.other + item.your)) * 100,
        })
      );

      sharesChart.data = sharesDataTmpUnwrapped;
      return () => {
        sharesChart.dispose();
      };
    }
  }, [shareLogState.data]);

  return (
    <>
      <h2>Advanced PPLNS Statistics</h2>
      <CardGrid>
        <Card padding>
          <CardTitle>
            {'Average Paying Hashrate '}
            <Tooltip>
              <TooltipContent
                message={
                  'Calculated based on current round share and the last 3 hours pool hashrate chart'
                }
              />
            </Tooltip>
          </CardTitle>
          <StatItem
            value={
              averagePoolHashrate &&
              headerStatsData &&
              formatSi(averagePoolHashrate * headerStatsData.roundShare, 'H/s')
            }
            subValue={
              poolHashrate &&
              headerStatsData &&
              `Current: ${formatSi(
                poolHashrate * headerStatsData.roundShare,
                'H/s'
              )}`
            }
          />
        </Card>
        <Card padding>
          <CardTitle>
            Current Round Share&nbsp;
            <Tooltip>
              <TooltipContent message={'Derived from the share log'} />
            </Tooltip>
          </CardTitle>
          <StatItem
            value={
              headerStatsData &&
              `${
                Math.round(headerStatsData.roundShare * 100 * 100000000) /
                100000000
              }%`
            }
            subValue={
              approximateBlockShare && (
                <>Aproximate reward: {approximateBlockShare}</>
              )
            }
          />
        </Card>
        <Card padding>
          <CardTitle>
            Share Log Wipeout Duration{' '}
            <Tooltip>
              <TooltipContent
                message={'Time for the round share to drop to zero'}
              />
            </Tooltip>
          </CardTitle>
          <StatItem
            value={
              averagePoolHashrate &&
              shareLogLength &&
              activeCoin &&
              `${dateUtils.durationWords(
                (shareLogLength * activeCoin.shareDifficulty) /
                  averagePoolHashrate,
                { includeSeconds: true }
              )}`
            }
            subValue={
              averagePoolHashrate &&
              shareLogLength &&
              `${formatSi(shareLogLength, '')} Shares in Log • ${formatSi(
                averagePoolHashrate,
                'H/s'
              )}`
            }
          />
        </Card>
      </CardGrid>
      <Spacer />
      <ChartContainer title="Shares in the PPLNS Log" dataState={shareLogState}>
        <div id="shares-chart" style={{ width: '100%', height: '250px' }}></div>
      </ChartContainer>
    </>
  );
};
