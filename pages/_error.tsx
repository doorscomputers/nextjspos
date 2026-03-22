import Error from "next/error";

const CustomErrorComponent = (props: { statusCode?: number }) => {
  return <Error statusCode={props.statusCode || 500} />;
};

CustomErrorComponent.getInitialProps = async (contextData: { res?: { statusCode?: number }; err?: { statusCode?: number } }) => {
  const statusCode = contextData.res?.statusCode ?? contextData.err?.statusCode ?? 500;
  return { statusCode };
};

export default CustomErrorComponent;
