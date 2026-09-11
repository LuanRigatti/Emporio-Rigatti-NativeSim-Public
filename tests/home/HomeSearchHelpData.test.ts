import {
  getHomeSearchHelpSuggestions,
  HOME_SEARCH_HELP_CATEGORIES,
} from '@/features/home/help/HomeSearchHelpData';
import { homeSearchQueryParser } from '@/features/home/search/HomeSearchQueryParser';

describe('HomeSearchHelpData', () => {
  it('builds the three quick suggestions from the device month in Portuguese', () => {
    const suggestions = getHomeSearchHelpSuggestions(new Date(2026, 8, 9, 12));

    expect(suggestions.slice(0, 3).map((suggestion) => suggestion.label)).toEqual([
      'Faturamento',
      'Lucro Líquido',
      'Resumo',
    ]);
    expect(suggestions.slice(0, 3).map((suggestion) => suggestion.query)).toEqual([
      'faturamento setembro',
      'lucro líquido setembro',
      'resumo setembro',
    ]);
  });

  it('follows the local month across December and January without a hardcoded year', () => {
    const december = getHomeSearchHelpSuggestions(new Date(2026, 11, 31, 12));
    const january = getHomeSearchHelpSuggestions(new Date(2027, 0, 1, 12));

    expect(december[0]?.query).toBe('faturamento dezembro');
    expect(january[0]?.query).toBe('faturamento janeiro');
    expect(january[0]?.query).not.toContain('2026');
    expect(homeSearchQueryParser.parse(january[0]?.query ?? '', new Date(2027, 0, 1, 12)).period).toEqual({
      kind: 'month',
      month: 1,
      year: 2027,
    });
  });

  it('contains exactly 6 categories with valid identifiers and system images', () => {
    expect(HOME_SEARCH_HELP_CATEGORIES).toHaveLength(6);
    expect(HOME_SEARCH_HELP_CATEGORIES.map((cat) => cat.id)).toEqual([
      'clients',
      'finance',
      'factory',
      'routes',
      'car',
      'summaries',
    ]);
    HOME_SEARCH_HELP_CATEGORIES.forEach((cat) => {
      expect(cat.title).toBeTruthy();
      expect(cat.systemImage).toBeTruthy();
      expect(cat.examples.length).toBeGreaterThan(0);
    });
  });

  it('contains exactly 27 audited search examples across 6 categories', () => {
    const totalExamples = HOME_SEARCH_HELP_CATEGORIES.reduce(
      (total, cat) => total + cat.examples.length,
      0,
    );
    expect(totalExamples).toBe(27);
  });

  it('verifies that every help example query parses successfully in HomeSearchQueryParser', () => {
    const referenceDate = new Date(2026, 7, 18); // August 18, 2026

    HOME_SEARCH_HELP_CATEGORIES.forEach((category) => {
      category.examples.forEach((example) => {
        const parsed = homeSearchQueryParser.parse(example.query, referenceDate);
        expect(parsed).toBeDefined();
        expect(parsed.normalized.length).toBeGreaterThan(0);

        // Verify specific category semantics
        if (category.id === 'clients') {
          expect(parsed.text.length).toBeGreaterThan(0);
        } else if (category.id === 'finance') {
          expect(parsed.financialMetric).toBeDefined();
        } else if (category.id === 'factory') {
          expect(parsed.factoryMetric).toBeDefined();
        } else if (category.id === 'routes') {
          expect(parsed.routeMetric).toBeDefined();
        } else if (category.id === 'car') {
          expect(parsed.carMetric).toBeDefined();
        } else if (category.id === 'summaries') {
          expect(parsed.periodSummary).toBe(true);
        }
      });
    });
  });

  it('has unique IDs for all categories and examples', () => {
    const categoryIds = new Set<string>();
    const exampleIds = new Set<string>();

    HOME_SEARCH_HELP_CATEGORIES.forEach((cat) => {
      expect(categoryIds.has(cat.id)).toBe(false);
      categoryIds.add(cat.id);

      cat.examples.forEach((ex) => {
        expect(exampleIds.has(ex.id)).toBe(false);
        exampleIds.add(ex.id);
      });
    });
  });
});
