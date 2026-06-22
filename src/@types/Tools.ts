export type SuccsessResult = {
  success: true;
  data: any;
};

export type ErrorResult = {
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

