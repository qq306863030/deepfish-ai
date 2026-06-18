export type succsessResult = {
  success: true;
  data: any;
};

export type errorResult = {
  success: false;
  error: string;
  data?: any;
};

export interface Description {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}