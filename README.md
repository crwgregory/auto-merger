# Auto Merge for AWS Lambda
I made this so that I could push code changes into a `staging` branch, then have this script
run after hours (triggered by an AWS Event) and merge `staging` into `master`. From there I have
AWS CodePipeline hooked up to deploy the application. Also, I have Cloudwatch Listening for errors
on the Lambda Function and will alert if any errors are returned.