export type SearchHelpExample = {
  id: string;
  label: string;
  query: string;
  description?: string;
};

export type SearchHelpCategory = {
  id: string;
  title: string;
  systemImage: string;
  examples: readonly SearchHelpExample[];
};
